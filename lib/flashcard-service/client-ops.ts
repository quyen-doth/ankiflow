/**
 * Thao tác AnkiConnect bậc cao chạy CLIENT-SIDE (trong browser của user).
 * Mirror logic trước đây ở các API route server (`/api/anki/ensure-model`, `/api/anki/decks`)
 * nhưng gọi thẳng AnkiConnect trên máy user thay vì qua server.
 *
 * Nhận `client` làm tham số để dễ test (truyền mock) và để caller tự quyết định URL
 * (qua `getAnkiClientFromSettings()`).
 */
import type { IFlashcardService } from './types'
import {
  ANKI_MODEL_NAME,
  ANKI_MODEL_FIELDS,
  ANKI_CARD_TEMPLATES,
  ANKI_CARD_CSS,
} from '@/lib/anki/model'

/**
 * Đảm bảo model AnkiFlow-Basic tồn tại. Nếu đã có → đồng bộ CSS + template
 * (cập nhật card cũ); nếu chưa → tạo mới.
 */
export async function ensureModel(client: IFlashcardService): Promise<void> {
  const models = await client.getModelNames()

  if (models.includes(ANKI_MODEL_NAME)) {
    await Promise.all([
      client.updateModelStyling(ANKI_MODEL_NAME, ANKI_CARD_CSS),
      client.updateModelTemplates(ANKI_MODEL_NAME, ANKI_CARD_TEMPLATES),
    ])
    return
  }

  await client.createModel({
    modelName: ANKI_MODEL_NAME,
    inOrderFields: ANKI_MODEL_FIELDS,
    css: ANKI_CARD_CSS,
    cardTemplates: ANKI_CARD_TEMPLATES,
  })
}

// ─── Deck operations (mirror app/api/anki/decks POST) ─────────────────────────

const deckQuery = (name: string) => `deck:"${name}"`

/** Tạo deck nếu chưa tồn tại (idempotent). */
export async function ensureDeck(client: IFlashcardService, deckName: string): Promise<void> {
  await client.createDeck(deckName)
}

/** Đổi tên deck: tạo deck mới → chuyển toàn bộ card → xóa deck cũ. */
export async function renameDeck(
  client: IFlashcardService,
  oldName: string,
  newName: string,
): Promise<void> {
  if (oldName === newName) {
    await client.createDeck(newName)
    return
  }
  await client.createDeck(newName)
  const cards = await client.findCards(deckQuery(oldName))
  await client.changeDeck(cards, newName)
  await client.deleteDecks([oldName])
}

/**
 * Xóa deck (kèm toàn bộ card), rồi dọn các deck cha rỗng đi lên theo phân cấp `::`.
 * Trả về danh sách deck cha đã dọn.
 */
export async function deleteDeckWithCleanup(
  client: IFlashcardService,
  deckName: string,
): Promise<string[]> {
  await client.deleteDecks([deckName], true)

  const cleanedParents: string[] = []
  try {
    const remaining = await client.getDecks()
    const remainingSet = new Set(remaining)
    const parts = deckName.split('::')
    for (let depth = parts.length - 1; depth >= 1; depth--) {
      const parent = parts.slice(0, depth).join('::')
      if (!remainingSet.has(parent)) break
      const hasChildren = remaining.some((d) => d.startsWith(parent + '::'))
      if (hasChildren) break
      await client.deleteDecks([parent], true)
      remainingSet.delete(parent)
      cleanedParents.push(parent)
    }
  } catch (e) {
    console.warn('Parent cleanup failed (non-fatal):', e)
  }
  return cleanedParents
}

/** Suspend/unsuspend toàn bộ card trong deck (deck active ↔ inactive). */
export async function setDeckSuspended(
  client: IFlashcardService,
  deckName: string,
  suspended: boolean,
): Promise<void> {
  const cards = await client.findCards(deckQuery(deckName))
  if (suspended) await client.suspend(cards)
  else await client.unsuspend(cards)
}

export interface SyncAllResult {
  success: boolean
  synced: number
  total: number
  failed: { name: string; error: string }[]
}

/** Push tất cả deck của app sang Anki: đảm bảo tồn tại + suspend/unsuspend theo status. */
export async function syncAllDecks(
  client: IFlashcardService,
  decks: { name: string; is_active: boolean }[],
): Promise<SyncAllResult> {
  let synced = 0
  const failed: { name: string; error: string }[] = []

  for (const d of decks) {
    if (!d?.name) continue
    try {
      await client.createDeck(d.name)
      const cards = await client.findCards(deckQuery(d.name))
      if (d.is_active) await client.unsuspend(cards)
      else await client.suspend(cards)
      synced++
    } catch (e) {
      failed.push({ name: d.name, error: (e as Error).message })
    }
  }

  return { success: failed.length === 0, synced, total: decks.length, failed }
}
