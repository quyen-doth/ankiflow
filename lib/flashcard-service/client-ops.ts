/**
 * CLIENT-SIDE (ユーザーのブラウザ内) で実行される高レベルの AnkiConnect 操作。
 * 以前サーバー API route (`/api/anki/ensure-model`、`/api/anki/decks`) にあった
 * ロジックを鏡写しにしているが、サーバー経由ではなくユーザーのマシン上の
 * AnkiConnect を直接呼び出す。
 *
 * テストしやすくする (mock を渡せる) ため、また caller が URL を自分で決定できる
 * (`getAnkiClientFromSettings()` 経由) ようにするため `client` を引数として受け取る。
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
 * model AnkiFlow-Basic の存在を保証する。既にあれば → CSS + template を同期
 * (既存カードを更新); なければ → 新規作成。
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

// ─── Deck operations (app/api/anki/decks POST を鏡写し) ─────────────────────────

const deckQuery = (name: string) => `deck:"${name}"`

/** deck が存在しなければ作成 (idempotent)。 */
export async function ensureDeck(client: IFlashcardService, deckName: string): Promise<void> {
  await client.createDeck(deckName)
}

/** deck 名を変更: 新しい deck を作成 → 全カードを移動 → 古い deck を削除。 */
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
 * deck を削除 (全カードごと)、その後 `::` 階層に沿って空になった親 deck を上方向に整理する。
 * 整理した親 deck のリストを返す。
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

/** deck 内のすべてのカードを Suspend/unsuspend する (deck active ↔ inactive)。 */
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

/** アプリのすべての deck を Anki に push: 存在を保証 + status に応じて suspend/unsuspend。 */
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

// ─── Note creation (直接 export + 後で sync で共有) ───────────────

const sanitizeFilename = (s: string) => s.replace(/[\s/\\:*?"<>|]/g, '_')

/** audio data-URL を Anki media に保存し、保存したファイル名を返す (スキップ/エラー時は undefined — best-effort)。 */
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

/** ローカル画像 (data-URL) を Anki media に保存し、保存したファイル名を返す (スキップ/エラー時は undefined)。 */
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
 * 1 つの entry のすべての note を Anki に作成: メディア保存 (best-effort) → buildNotes →
 * すべての deck の存在を保証 (idempotent) → addNotes。作成された note ids を返す。
 * 直接 export (useAnkiExport) と後で sync (sidebar) の両方で共有し、2 つの経路の
 * 動作が決してずれないようにする。model は ensure しない — caller が batch ごとに
 * 1 回 ensureModel を呼ぶ。
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

// ─── Note regeneration (entry の update + resync で共有) ─────────────────

type RegenEntry = Partial<Entry> & { anki_note_ids?: number[]; card_type_ids?: string[] }

export interface RegenResult {
  updated: number
  skipped: number
  failed: number
  errors: string[]
}

/**
 * 現在の template に従って 1 つの entry に属するすべての note の Front/Back を再生成し
 * (既存のメディアを保持)、AnkiConnect 経由で各 note に `updateNoteFields` を実行する。
 * 統計を返す。
 *
 * `notesInfo` (既存メディアの読み込み) は Anki がオフラインの場合 throw する可能性がある —
 * caller が処理を決定する (update entry: best-effort でエラーを飲み込む; resync: failed をカウント)。
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
