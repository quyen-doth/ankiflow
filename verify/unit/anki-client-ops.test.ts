import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  ensureModel,
  ensureDeck,
  renameDeck,
  deleteDeckWithCleanup,
  setDeckSuspended,
  syncAllDecks,
} from '@/lib/flashcard-service/client-ops'
import { ANKI_MODEL_NAME } from '@/lib/anki/model'
import type { IFlashcardService } from '@/lib/flashcard-service/types'

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
