import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// Mock client provider — kiểm soát AnkiConnect từ browser
const mockClient = {
  storeMediaFile: vi.fn(async (f: string) => f),
  createDeck: vi.fn(async () => 1),
  addNotes: vi.fn(async () => [111, 222]),
}
vi.mock('@/lib/flashcard-service/client', () => ({
  getAnkiClientFromSettings: vi.fn(async () => mockClient),
}))

import { exportEntryToAnki, saveEntryToFirestore } from '@/hooks/useAnkiExport'
import type { Entry } from '@/types'

const entry: Partial<Entry> = {
  word: 'resilient',
  anki_deck: 'MyDeck',
  tags: [],
}
const cardTypes = [{ id: 'ct1', name: 'Word → Meaning', code: 'word_to_meaning' }]

function stubFetch(status = 200, json: unknown = { success: true, entryId: 'e1' }) {
  const mock = vi.fn(
    async () =>
      new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } }),
  )
  vi.stubGlobal('fetch', mock)
  return mock
}

beforeEach(() => {
  mockClient.storeMediaFile.mockClear()
  mockClient.createDeck.mockClear()
  mockClient.addNotes.mockClear()
  mockClient.addNotes.mockResolvedValue([111, 222])
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('exportEntryToAnki — client-side', () => {
  it('tạo deck + addNotes qua AnkiConnect, rồi persist entry status synced + note ids', async () => {
    const fetchMock = stubFetch()

    const result = await exportEntryToAnki(entry, cardTypes)

    expect(result).toEqual({ ok: true, noteCount: 1 })
    expect(mockClient.createDeck).toHaveBeenCalledWith('MyDeck')
    expect(mockClient.addNotes).toHaveBeenCalledOnce()

    // POST /api/entries/save với status 'synced' + anki_note_ids từ Anki
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/entries/save')
    const body = JSON.parse(init.body as string)
    expect(body.status).toBe('synced')
    expect(body.anki_note_ids).toEqual([111, 222])
    expect(body.entryData.card_type_ids).toEqual(['ct1'])
  })

  it('Anki offline (addNotes throw) → ok:false, KHÔNG gọi save', async () => {
    const fetchMock = stubFetch()
    mockClient.addNotes.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const result = await exportEntryToAnki(entry, cardTypes)

    expect(result.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('tạo note thành công nhưng save Firestore lỗi → ok:false', async () => {
    stubFetch(500, { error: 'Firestore down' })

    const result = await exportEntryToAnki(entry, cardTypes)

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Firestore down')
  })

  it('lưu audio data-URL vào Anki media trước khi build notes', async () => {
    stubFetch()
    const withAudio = { ...entry, audio_url: 'data:audio/mp3;base64,QUJD' }

    await exportEntryToAnki(withAudio, cardTypes)

    expect(mockClient.storeMediaFile).toHaveBeenCalledWith(expect.stringContaining('ankiflow_resilient'), 'QUJD')
  })
})

describe('saveEntryToFirestore — deferred vs synced', () => {
  it('deferred (không opts) → body không kèm status/anki_note_ids (server mặc định reviewed)', async () => {
    const fetchMock = stubFetch()

    await saveEntryToFirestore(entry, cardTypes)

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.status).toBeUndefined()
    expect(body.anki_note_ids).toBeUndefined()
    expect(body.entryData.card_type_ids).toEqual(['ct1'])
  })

  it('kèm opts → body có status + anki_note_ids', async () => {
    const fetchMock = stubFetch()

    await saveEntryToFirestore(entry, cardTypes, { ankiNoteIds: [5], status: 'synced' })

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.status).toBe('synced')
    expect(body.anki_note_ids).toEqual([5])
  })
})
