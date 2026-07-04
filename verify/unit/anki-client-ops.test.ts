import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  ensureModel,
  ensureDeck,
  renameDeck,
  deleteDeckWithCleanup,
  setDeckSuspended,
  syncAllDecks,
  regenerateNotesForEntry,
  createNotesForEntry,
} from '@/lib/flashcard-service/client-ops'
import { ANKI_MODEL_NAME } from '@/lib/anki/model'
import type { IFlashcardService, AnkiNoteInfo } from '@/lib/flashcard-service/types'
import type { CardTypeItem } from '@/lib/buildNotes'

/** Mock provider — mọi method là vi.fn(), override khi cần trong từng test. */
function makeClient(overrides: Partial<Record<keyof IFlashcardService, unknown>> = {}): IFlashcardService {
  const base: IFlashcardService = {
    ping: vi.fn(async () => ({ connected: true, version: 6 })),
    getDecks: vi.fn(async () => []),
    createDeck: vi.fn(async () => 1),
    addNotes: vi.fn(async () => []),
    updateNoteFields: vi.fn(async () => {}),
    findNotes: vi.fn(async () => []),
    notesInfo: vi.fn(async () => []),
    findCards: vi.fn(async () => []),
    cardsInfo: vi.fn(async () => []),
    suspend: vi.fn(async () => true),
    unsuspend: vi.fn(async () => true),
    changeDeck: vi.fn(async () => {}),
    deleteDecks: vi.fn(async () => {}),
    storeMediaFile: vi.fn(async (f: string) => f),
    getModelNames: vi.fn(async () => []),
    createModel: vi.fn(async () => {}),
    updateModelStyling: vi.fn(async () => {}),
    updateModelTemplates: vi.fn(async () => {}),
  }
  return Object.assign(base, overrides)
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('ensureModel', () => {
  it('tạo model mới khi chưa tồn tại (không sync styling)', async () => {
    const client = makeClient({ getModelNames: vi.fn(async () => ['Other']) })

    await ensureModel(client)

    expect(client.createModel).toHaveBeenCalledOnce()
    expect((client.createModel as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      modelName: ANKI_MODEL_NAME,
      inOrderFields: ['Front', 'Back'],
    })
    expect(client.updateModelStyling).not.toHaveBeenCalled()
    expect(client.updateModelTemplates).not.toHaveBeenCalled()
  })

  it('đồng bộ CSS + template khi model đã tồn tại (không tạo lại)', async () => {
    const client = makeClient({ getModelNames: vi.fn(async () => [ANKI_MODEL_NAME]) })

    await ensureModel(client)

    expect(client.createModel).not.toHaveBeenCalled()
    expect(client.updateModelStyling).toHaveBeenCalledOnce()
    expect(client.updateModelTemplates).toHaveBeenCalledOnce()
  })
})

describe('ensureDeck', () => {
  it('gọi createDeck (idempotent)', async () => {
    const client = makeClient()
    await ensureDeck(client, 'AnkiFlow::EN')
    expect(client.createDeck).toHaveBeenCalledWith('AnkiFlow::EN')
  })
})

describe('renameDeck', () => {
  it('tên giống nhau → chỉ createDeck, không move/delete', async () => {
    const client = makeClient()
    await renameDeck(client, 'Same', 'Same')
    expect(client.createDeck).toHaveBeenCalledWith('Same')
    expect(client.changeDeck).not.toHaveBeenCalled()
    expect(client.deleteDecks).not.toHaveBeenCalled()
  })

  it('tên khác → tạo deck mới, chuyển card, xóa deck cũ', async () => {
    const client = makeClient({ findCards: vi.fn(async () => [11, 22]) })

    await renameDeck(client, 'Old', 'New')

    expect(client.createDeck).toHaveBeenCalledWith('New')
    expect(client.findCards).toHaveBeenCalledWith('deck:"Old"')
    expect(client.changeDeck).toHaveBeenCalledWith([11, 22], 'New')
    expect(client.deleteDecks).toHaveBeenCalledWith(['Old'])
  })
})

describe('deleteDeckWithCleanup', () => {
  it('xóa deck + dọn deck cha rỗng sâu nhất theo phân cấp ::', async () => {
    // getDecks (chụp 1 lần) trả ['A::B', 'A']; sau khi xóa 'A::B::C', 'A::B' rỗng → dọn.
    // Lưu ý: 'A' KHÔNG bị dọn vì hasChildren dùng mảng remaining tĩnh vẫn còn thấy 'A::B' (hành vi nguyên bản).
    const client = makeClient({ getDecks: vi.fn(async () => ['A::B', 'A']) })

    const cleaned = await deleteDeckWithCleanup(client, 'A::B::C')

    expect(client.deleteDecks).toHaveBeenCalledWith(['A::B::C'], true)
    expect(cleaned).toEqual(['A::B'])
  })

  it('giữ deck cha nếu còn con khác', async () => {
    // Còn 'A::B::Sibling' → 'A::B' có con → dừng, không dọn
    const client = makeClient({ getDecks: vi.fn(async () => ['A::B', 'A::B::Sibling', 'A']) })

    const cleaned = await deleteDeckWithCleanup(client, 'A::B::C')

    expect(cleaned).toEqual([])
  })

  it('lỗi cleanup không làm fail cả thao tác (best-effort)', async () => {
    const client = makeClient({
      getDecks: vi.fn(async () => {
        throw new Error('anki down')
      }),
    })

    await expect(deleteDeckWithCleanup(client, 'A::B')).resolves.toEqual([])
    expect(client.deleteDecks).toHaveBeenCalledWith(['A::B'], true)
  })
})

describe('setDeckSuspended', () => {
  it('suspended=true → suspend các card trong deck', async () => {
    const client = makeClient({ findCards: vi.fn(async () => [1, 2]) })
    await setDeckSuspended(client, 'D', true)
    expect(client.suspend).toHaveBeenCalledWith([1, 2])
    expect(client.unsuspend).not.toHaveBeenCalled()
  })

  it('suspended=false → unsuspend', async () => {
    const client = makeClient({ findCards: vi.fn(async () => [3]) })
    await setDeckSuspended(client, 'D', false)
    expect(client.unsuspend).toHaveBeenCalledWith([3])
    expect(client.suspend).not.toHaveBeenCalled()
  })
})

describe('syncAllDecks', () => {
  it('đảm bảo deck tồn tại + suspend/unsuspend theo is_active', async () => {
    const client = makeClient()

    const result = await syncAllDecks(client, [
      { name: 'Active', is_active: true },
      { name: 'Inactive', is_active: false },
    ])

    expect(result).toEqual({ success: true, synced: 2, total: 2, failed: [] })
    expect(client.createDeck).toHaveBeenCalledWith('Active')
    expect(client.createDeck).toHaveBeenCalledWith('Inactive')
    expect(client.unsuspend).toHaveBeenCalled()
    expect(client.suspend).toHaveBeenCalled()
  })

  it('gom lỗi từng deck, không throw cả batch', async () => {
    const client = makeClient({
      createDeck: vi.fn(async (name: string) => {
        if (name === 'Bad') throw new Error('boom')
        return 1
      }),
    })

    const result = await syncAllDecks(client, [
      { name: 'Good', is_active: true },
      { name: 'Bad', is_active: true },
    ])

    expect(result.synced).toBe(1)
    expect(result.success).toBe(false)
    expect(result.failed).toEqual([{ name: 'Bad', error: 'boom' }])
  })
})

describe('createNotesForEntry', () => {
  const cardTypes: CardTypeItem[] = [
    { id: 'ct1', name: 'Word → Meaning', code: 'word_to_meaning' },
    { id: 'ct2', name: 'Meaning → Word', code: 'meaning_to_word' },
  ]

  it('store audio data-URL vào Anki media rồi tạo deck + addNotes', async () => {
    const client = makeClient({ addNotes: vi.fn(async () => [11, 22]) })
    const entry = {
      word: 'resilient',
      anki_deck: 'MyDeck',
      tags: [],
      audio_url: 'data:audio/mp3;base64,QUJD',
    }

    const noteIds = await createNotesForEntry(client, entry, cardTypes)

    expect(noteIds).toEqual([11, 22])
    expect(client.storeMediaFile).toHaveBeenCalledWith(expect.stringContaining('ankiflow_resilient'), 'QUJD')
    // 2 notes cùng 1 deck → createDeck đúng 1 lần (dedupe)
    expect(client.createDeck).toHaveBeenCalledTimes(1)
    expect(client.createDeck).toHaveBeenCalledWith('MyDeck')
    expect(client.addNotes).toHaveBeenCalledOnce()
  })

  it('audio http URL (không phải data-URL) → KHÔNG store media', async () => {
    const client = makeClient()
    const entry = { word: 'x', anki_deck: 'D', tags: [], audio_url: 'https://cdn/x.mp3' }

    await createNotesForEntry(client, entry, cardTypes)

    expect(client.storeMediaFile).not.toHaveBeenCalled()
  })

  it('storeMediaFile lỗi → best-effort, vẫn addNotes (không throw)', async () => {
    const client = makeClient({
      storeMediaFile: vi.fn(async () => {
        throw new Error('anki down mid-way')
      }),
      addNotes: vi.fn(async () => [1]),
    })
    const entry = { word: 'x', anki_deck: 'D', tags: [], audio_url: 'data:audio/mp3;base64,QUJD' }

    await expect(createNotesForEntry(client, entry, [cardTypes[0]])).resolves.toEqual([1])
  })

  it('addNotes throw (Anki đóng) → propagate cho caller xử lý', async () => {
    const client = makeClient({
      addNotes: vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    })

    await expect(
      createNotesForEntry(client, { word: 'x', anki_deck: 'D', tags: [] }, cardTypes),
    ).rejects.toThrow('Failed to fetch')
  })
})

describe('regenerateNotesForEntry', () => {
  const cardTypes: CardTypeItem[] = [
    { id: 'ct1', name: 'Word → Meaning', code: 'word_to_meaning' },
    { id: 'ct2', name: 'Meaning → Word', code: 'meaning_to_word' },
  ]
  // entry map anki_note_ids[i] ↔ card_type_ids[i] theo thứ tự
  const entry = { word: 'resilient', anki_deck: 'D', tags: [], anki_note_ids: [11, 22], card_type_ids: ['ct1', 'ct2'] }

  const noteInfo = (noteId: number): AnkiNoteInfo => ({
    noteId,
    fields: { Front: { value: '', order: 0 }, Back: { value: '', order: 1 } },
  })

  it('entry không có note → không gọi Anki, trả zeros', async () => {
    const client = makeClient()
    const r = await regenerateNotesForEntry(client, { anki_note_ids: [], card_type_ids: [] }, cardTypes)
    expect(r).toEqual({ updated: 0, skipped: 0, failed: 0, errors: [] })
    expect(client.notesInfo).not.toHaveBeenCalled()
  })

  it('sinh lại + updateNoteFields cho từng note khớp card type', async () => {
    const client = makeClient({ notesInfo: vi.fn(async () => [noteInfo(11), noteInfo(22)]) })

    const r = await regenerateNotesForEntry(client, entry, cardTypes)

    expect(r.updated).toBe(2)
    expect(r.failed).toBe(0)
    expect(client.updateNoteFields).toHaveBeenCalledTimes(2)
    const calledNoteIds = (client.updateNoteFields as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])
    expect(calledNoteIds).toEqual([11, 22])
  })

  it('card type đã xoá (không có trong map) → skipped', async () => {
    const client = makeClient({ notesInfo: vi.fn(async () => [noteInfo(11), noteInfo(22)]) })
    // chỉ cung cấp ct1 → note của ct2 bị skip
    const r = await regenerateNotesForEntry(client, entry, [cardTypes[0]])
    expect(r.updated).toBe(1)
    expect(r.skipped).toBe(1)
    expect(client.updateNoteFields).toHaveBeenCalledTimes(1)
  })

  it('onlyCardTypeId → chỉ sinh lại note của card type đó', async () => {
    const client = makeClient({ notesInfo: vi.fn(async () => [noteInfo(11), noteInfo(22)]) })
    const r = await regenerateNotesForEntry(client, entry, cardTypes, 'ct2')
    expect(r.updated).toBe(1)
    const calledNoteIds = (client.updateNoteFields as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])
    expect(calledNoteIds).toEqual([22])
  })

  it('updateNoteFields lỗi 1 note → failed + errors, note kia vẫn updated', async () => {
    const client = makeClient({
      notesInfo: vi.fn(async () => [noteInfo(11), noteInfo(22)]),
      updateNoteFields: vi.fn(async (noteId: number) => {
        if (noteId === 22) throw new Error('anki down')
      }),
    })

    const r = await regenerateNotesForEntry(client, entry, cardTypes)

    expect(r.updated).toBe(1)
    expect(r.failed).toBe(1)
    expect(r.errors[0]).toContain('note 22')
  })

  it('số note ≠ số card type → skip toàn bộ (map không an toàn)', async () => {
    const client = makeClient({ notesInfo: vi.fn(async () => [noteInfo(11), noteInfo(22)]) })
    const mismatched = { ...entry, card_type_ids: ['ct1'] } // 2 note, 1 card type
    const r = await regenerateNotesForEntry(client, mismatched, cardTypes)
    expect(r.updated).toBe(0)
    expect(r.skipped).toBe(2)
    expect(client.updateNoteFields).not.toHaveBeenCalled()
  })
})
