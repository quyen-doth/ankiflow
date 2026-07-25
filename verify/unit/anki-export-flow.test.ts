import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// 検証用コメント。
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
  meaning_vi: 'able to recover',
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
  it('AnkiConnect 経由で deck 作成 + addNotes した後、entry status synced + note ids を永続化', async () => {
    const fetchMock = stubFetch()

    const result = await exportEntryToAnki(entry, cardTypes)

    expect(result).toEqual({ ok: true, noteCount: 1 })
    expect(mockClient.createDeck).toHaveBeenCalledWith('MyDeck')
    expect(mockClient.addNotes).toHaveBeenCalledOnce()

    // status 'synced' + Anki 由来の anki_note_ids で POST /api/entries/save
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/entries/save')
    const body = JSON.parse(init.body as string)
    expect(body.status).toBe('synced')
    expect(body.anki_note_ids).toEqual([111, 222])
    expect(body.entryData.card_type_ids).toEqual(['ct1'])
  })

  it('Anki オフライン (addNotes が throw) → ok:false、save を呼ばない', async () => {
    const fetchMock = stubFetch()
    mockClient.addNotes.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const result = await exportEntryToAnki(entry, cardTypes)

    expect(result.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('note 作成成功だが Firestore への save が失敗 → ok:false', async () => {
    stubFetch(500, { error: 'Firestore down' })

    const result = await exportEntryToAnki(entry, cardTypes)

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Firestore down')
  })

  it('notes を build する前に audio data-URL を Anki media に保存', async () => {
    stubFetch()
    const withAudio = { ...entry, audio_url: 'data:audio/mp3;base64,QUJD' }

    await exportEntryToAnki(withAudio, cardTypes)

    expect(mockClient.storeMediaFile).toHaveBeenCalledWith(expect.stringContaining('ankiflow_resilient'), 'QUJD')
  })
})

describe('saveEntryToFirestore — deferred vs synced', () => {
  it('deferred (opts なし) → body に status/anki_note_ids を含まない (サーバーはデフォルトで reviewed)', async () => {
    const fetchMock = stubFetch()

    await saveEntryToFirestore(entry, cardTypes)

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.status).toBeUndefined()
    expect(body.anki_note_ids).toBeUndefined()
    expect(body.entryData.card_type_ids).toEqual(['ct1'])
  })

  it('opts あり → body に status + anki_note_ids を含む', async () => {
    const fetchMock = stubFetch()

    await saveEntryToFirestore(entry, cardTypes, { ankiNoteIds: [5], status: 'synced' })

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.status).toBe('synced')
    expect(body.anki_note_ids).toEqual([5])
  })
})
