import type { Entry } from '@/types'
import type { AnkiNoteInfo } from '@/lib/flashcard-service/types'
import { buildNotes, type CardTypeItem } from '@/lib/buildNotes'
import { extractMedia } from '@/lib/anki/extractMedia'

export interface NoteFieldUpdate {
  noteId: number
  fields: Record<string, string>
}

interface EntryLike extends Partial<Entry> {
  anki_note_ids?: number[]
  card_type_ids?: string[]
}

/**
 * 現在の template に従って 1 つの entry のすべての note の Front/Back を再生成し、既存のメディアを保持する。
 * re-sync (Settings) と History からのカード編集で共有。
 *
 * `anki_note_ids[i] ↔ card_type_ids[i]` を順序通りにマップ。以下の場合はスキップ (skipped):
 * - note 数 ≠ card type 数 (安全にマップできない)、または
 * - card type が `cardTypeMap` にない (削除済み)。
 *
 * `onlyCardTypeId`: 渡された場合、その card type の note のみを再生成 (card type によるフィルタ用)。
 */
export function regenerateEntryNotes(
  entry: EntryLike,
  cardTypeMap: Map<string, CardTypeItem>,
  infoById: Map<number, AnkiNoteInfo>,
  onlyCardTypeId?: string,
): { updates: NoteFieldUpdate[]; skipped: number } {
  const noteIds = entry.anki_note_ids || []
  const ctIds = entry.card_type_ids || []

  if (noteIds.length === 0 || noteIds.length !== ctIds.length) {
    return { updates: [], skipped: noteIds.length }
  }

  const updates: NoteFieldUpdate[] = []
  let skipped = 0

  for (let i = 0; i < noteIds.length; i++) {
    const noteId = noteIds[i]
    const ctId = ctIds[i]

    if (onlyCardTypeId && ctId !== onlyCardTypeId) continue

    const cardType = cardTypeMap.get(ctId)
    if (!cardType) {
      skipped += 1
      continue
    }

    const info = infoById.get(noteId)
    const currentHtml = info ? Object.values(info.fields).map(f => f.value).join('\n') : ''
    const media = extractMedia(currentHtml)

    const [note] = buildNotes(entry, [cardType], media)
    updates.push({ noteId, fields: note.fields })
  }

  return { updates, skipped }
}
