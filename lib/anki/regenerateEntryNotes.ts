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
 * Sinh lại Front/Back cho toàn bộ note của 1 entry theo template hiện tại, giữ media cũ.
 * Dùng chung cho re-sync (Settings) và sửa thẻ từ History.
 *
 * Map `anki_note_ids[i] ↔ card_type_ids[i]` theo thứ tự. Bỏ qua (skipped) nếu:
 * - số note ≠ số card type (không map an toàn), hoặc
 * - card type không có trong `cardTypeMap` (đã xoá).
 *
 * `onlyCardTypeId`: nếu truyền, chỉ sinh lại note của card type đó (dùng cho filter theo card type).
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
    const { audioFilename, imageFilename } = extractMedia(currentHtml)

    const [note] = buildNotes(entry, [cardType], audioFilename, imageFilename)
    updates.push({ noteId, fields: note.fields })
  }

  return { updates, skipped }
}
