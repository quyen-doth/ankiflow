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

/** Mock provider — すべての method は vi.fn()。必要に応じて各テストで上書きする。 */
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
    deleteNotes: vi.fn(async () => {}),
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
  it('model が存在しない場合新規作成 (styling は sync しない)', async () => {
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

  it('model が既に存在する場合 CSS + template を同期 (再作成しない)', async () => {
    const client = makeClient({ getModelNames: vi.fn(async () => [ANKI_MODEL_NAME]) })

    await ensureModel(client)

    expect(client.createModel).not.toHaveBeenCalled()
    expect(client.updateModelStyling).toHaveBeenCalledOnce()
    expect(client.updateModelTemplates).toHaveBeenCalledOnce()
  })
})

describe('ensureDeck', () => {
  it('createDeck を呼ぶ (idempotent)', async () => {
    const client = makeClient()
    await ensureDeck(client, 'AnkiFlow::EN')
    expect(client.createDeck).toHaveBeenCalledWith('AnkiFlow::EN')
  })
})

describe('renameDeck', () => {
  it('同じ名前 → createDeck のみ、move/delete なし', async () => {
    const client = makeClient()
    await renameDeck(client, 'Same', 'Same')
    expect(client.createDeck).toHaveBeenCalledWith('Same')
    expect(client.changeDeck).not.toHaveBeenCalled()
    expect(client.deleteDecks).not.toHaveBeenCalled()
  })

  it('異なる名前 → 新しい deck を作成、card を移動、古い deck を削除', async () => {
    const client = makeClient({ findCards: vi.fn(async () => [11, 22]) })

    await renameDeck(client, 'Old', 'New')

    expect(client.createDeck).toHaveBeenCalledWith('New')
    expect(client.findCards).toHaveBeenCalledWith('deck:"Old"')
    expect(client.changeDeck).toHaveBeenCalledWith([11, 22], 'New')
    expect(client.deleteDecks).toHaveBeenCalledWith(['Old'])
  })
})

describe('deleteDeckWithCleanup', () => {
  it('deck を削除 + `::` 階層に沿って最も深い空の親 deck を整理', async () => {
    // 検証用コメント。
    // 検証用コメント。
    const client = makeClient({ getDecks: vi.fn(async () => ['A::B', 'A']) })

    const cleaned = await deleteDeckWithCleanup(client, 'A::B::C')

    expect(client.deleteDecks).toHaveBeenCalledWith(['A::B::C'], true)
    expect(cleaned).toEqual(['A::B'])
  })

  it('他の子がある場合は親 deck を保持', async () => {
    // 検証用コメント。
    const client = makeClient({ getDecks: vi.fn(async () => ['A::B', 'A::B::Sibling', 'A']) })

    const cleaned = await deleteDeckWithCleanup(client, 'A::B::C')

    expect(cleaned).toEqual([])
  })

  it('cleanup のエラーは操作全体を失敗させない (best-effort)', async () => {
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
  it('suspended=true → deck 内のカードを suspend', async () => {
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
  it('deck の存在を保証 + is_active に応じて suspend/unsuspend', async () => {
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

  it('各 deck のエラーを集約し、batch 全体は throw しない', async () => {
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

  it('audio data-URL を Anki media に store してから deck を作成 + addNotes', async () => {
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
    // 検証用コメント。
    expect(client.createDeck).toHaveBeenCalledTimes(1)
    expect(client.createDeck).toHaveBeenCalledWith('MyDeck')
    expect(client.addNotes).toHaveBeenCalledOnce()
  })

  it('audio が http URL (data-URL でない) → メディアを store しない', async () => {
    const client = makeClient()
    const entry = { word: 'x', anki_deck: 'D', tags: [], audio_url: 'https://cdn/x.mp3' }

    await createNotesForEntry(client, entry, cardTypes)

    expect(client.storeMediaFile).not.toHaveBeenCalled()
  })

  it('storeMediaFile がエラー → best-effort、addNotes は実行される (throw しない)', async () => {
    const client = makeClient({
      storeMediaFile: vi.fn(async () => {
        throw new Error('anki down mid-way')
      }),
      addNotes: vi.fn(async () => [1]),
    })
    const entry = { word: 'x', anki_deck: 'D', tags: [], audio_url: 'data:audio/mp3;base64,QUJD' }

    await expect(createNotesForEntry(client, entry, [cardTypes[0]])).resolves.toEqual([1])
  })

  it('addNotes が throw (Anki が閉じている) → caller に伝播して処理させる', async () => {
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
  // entry は anki_note_ids[i] ↔ card_type_ids[i] を同じ順序で対応付ける。
  const entry = { word: 'resilient', anki_deck: 'D', tags: [], anki_note_ids: [11, 22], card_type_ids: ['ct1', 'ct2'] }

  const noteInfo = (noteId: number): AnkiNoteInfo => ({
    noteId,
    fields: { Front: { value: '', order: 0 }, Back: { value: '', order: 1 } },
  })

  it('entry に note がない → Anki を呼ばない、zeros を返す', async () => {
    const client = makeClient()
    const r = await regenerateNotesForEntry(client, { anki_note_ids: [], card_type_ids: [] }, cardTypes)
    expect(r).toEqual({ updated: 0, skipped: 0, failed: 0, errors: [] })
    expect(client.notesInfo).not.toHaveBeenCalled()
  })

  it('card type に一致する各 note を再生成 + updateNoteFields', async () => {
    const client = makeClient({ notesInfo: vi.fn(async () => [noteInfo(11), noteInfo(22)]) })

    const r = await regenerateNotesForEntry(client, entry, cardTypes)

    expect(r.updated).toBe(2)
    expect(r.failed).toBe(0)
    expect(client.updateNoteFields).toHaveBeenCalledTimes(2)
    const calledNoteIds = (client.updateNoteFields as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])
    expect(calledNoteIds).toEqual([11, 22])
  })

  it('card type が削除済み (map にない) → skipped', async () => {
    const client = makeClient({ notesInfo: vi.fn(async () => [noteInfo(11), noteInfo(22)]) })
    // 検証用コメント。
    const r = await regenerateNotesForEntry(client, entry, [cardTypes[0]])
    expect(r.updated).toBe(1)
    expect(r.skipped).toBe(1)
    expect(client.updateNoteFields).toHaveBeenCalledTimes(1)
  })

  it('onlyCardTypeId → その card type の note のみ再生成', async () => {
    const client = makeClient({ notesInfo: vi.fn(async () => [noteInfo(11), noteInfo(22)]) })
    const r = await regenerateNotesForEntry(client, entry, cardTypes, 'ct2')
    expect(r.updated).toBe(1)
    const calledNoteIds = (client.updateNoteFields as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])
    expect(calledNoteIds).toEqual([22])
  })

  it('updateNoteFields が 1 つの note でエラー → failed + errors、もう一方の note は updated のまま', async () => {
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

  it('note 数 ≠ card type 数 → すべて skip (安全にマップできない)', async () => {
    const client = makeClient({ notesInfo: vi.fn(async () => [noteInfo(11), noteInfo(22)]) })
    const mismatched = { ...entry, card_type_ids: ['ct1'] } // 2 note, 1 card type
    const r = await regenerateNotesForEntry(client, mismatched, cardTypes)
    expect(r.updated).toBe(0)
    expect(r.skipped).toBe(2)
    expect(client.updateNoteFields).not.toHaveBeenCalled()
  })
})
