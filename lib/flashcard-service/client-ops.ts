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
import { regenerateEntryNotes } from '@/lib/anki/regenerateEntryNotes'
import { buildNotes, type CardTypeItem } from '@/lib/buildNotes'
import type { Entry } from '@/types'

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

// ─── Note creation (dùng chung cho export trực tiếp + sync-sau) ───────────────

const sanitizeFilename = (s: string) => s.replace(/[\s/\\:*?"<>|]/g, '_')

/** Lưu audio data-URL vào Anki media, trả tên file đã lưu (undefined nếu bỏ qua/lỗi — best-effort). */
export async function storeAudioMedia(
  client: IFlashcardService,
  entry: Partial<Entry>,
): Promise<string | undefined> {
  if (!entry.audio_url || !entry.audio_url.startsWith('data:audio')) return undefined
  const base64 = entry.audio_url.split(',')[1]
  if (!base64) return undefined
  const word = entry.word || entry.term || entry.title || 'audio'
  const fname = `ankiflow_${sanitizeFilename(word)}.mp3`
  try {
    return await client.storeMediaFile(fname, base64)
  } catch (e) {
    console.warn('Failed to store audio in Anki media — cards will export without audio:', e)
    return undefined
  }
}

/** Lưu ảnh cục bộ (data-URL) vào Anki media, trả tên file đã lưu (undefined nếu bỏ qua/lỗi). */
export async function storeImageMedia(
  client: IFlashcardService,
  entry: Partial<Entry>,
): Promise<string | undefined> {
  if (!entry.image_url || !entry.image_url.startsWith('data:image')) return undefined
  const match = entry.image_url.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.*)$/)
  const base64 = match?.[2]
  if (!base64) return undefined
  const ext = (match?.[1] || 'png').replace('jpeg', 'jpg')
  const word = entry.word || entry.term || entry.title || 'image'
  const fname = `ankiflow_img_${sanitizeFilename(word)}.${ext}`
  try {
    return await client.storeMediaFile(fname, base64)
  } catch (e) {
    console.warn('Failed to store image in Anki media — cards will export without image:', e)
    return undefined
  }
}

/**
 * Tạo toàn bộ note cho 1 entry trong Anki: store media (best-effort) → buildNotes →
 * đảm bảo mọi deck tồn tại (idempotent) → addNotes. Trả về note ids đã tạo.
 * Dùng chung cho export trực tiếp (useAnkiExport) và sync-sau (sidebar) để 2 đường
 * không bao giờ lệch hành vi. KHÔNG ensure model — caller gọi ensureModel 1 lần/batch.
 */
export async function createNotesForEntry(
  client: IFlashcardService,
  entry: Partial<Entry>,
  cardTypes: CardTypeItem[],
): Promise<number[]> {
  const audioFilename = await storeAudioMedia(client, entry)
  const imageFilename = await storeImageMedia(client, entry)

  const notes = buildNotes(entry, cardTypes, audioFilename, imageFilename)

  const deckNames = [...new Set(notes.map((n) => n.deckName))]
  for (const deckName of deckNames) {
    await client.createDeck(deckName)
  }
  return await client.addNotes(notes)
}

// ─── Note regeneration (dùng chung cho update entry + resync) ─────────────────

type RegenEntry = Partial<Entry> & { anki_note_ids?: number[]; card_type_ids?: string[] }

export interface RegenResult {
  updated: number
  skipped: number
  failed: number
  errors: string[]
}

/**
 * Sinh lại Front/Back của mọi note thuộc 1 entry theo template hiện tại (giữ media cũ),
 * rồi `updateNoteFields` từng note qua AnkiConnect. Trả về thống kê.
 *
 * `notesInfo` (đọc media cũ) có thể throw nếu Anki offline — caller quyết định xử lý
 * (update entry: best-effort nuốt lỗi; resync: đếm failed).
 */
export async function regenerateNotesForEntry(
  client: IFlashcardService,
  entry: RegenEntry,
  cardTypes: CardTypeItem[],
  onlyCardTypeId?: string,
): Promise<RegenResult> {
  const noteIds = entry.anki_note_ids || []
  if (noteIds.length === 0) return { updated: 0, skipped: 0, failed: 0, errors: [] }

  const infos = await client.notesInfo(noteIds)
  const infoById = new Map(infos.map((n) => [n.noteId, n]))
  const cardTypeMap = new Map(cardTypes.map((ct) => [ct.id, ct]))

  const { updates, skipped } = regenerateEntryNotes(entry, cardTypeMap, infoById, onlyCardTypeId)

  let updated = 0
  let failed = 0
  const errors: string[] = []
  for (const { noteId, fields } of updates) {
    try {
      await client.updateNoteFields(noteId, fields)
      updated += 1
    } catch (e) {
      failed += 1
      errors.push(`updateNoteFields failed for note ${noteId}: ${(e as Error).message}`)
    }
  }

  return { updated, skipped, failed, errors }
}
