import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { flashcardService } from '@/lib/flashcard-service'
import { type CardTypeItem } from '@/lib/buildNotes'
import { regenerateEntryNotes } from '@/lib/anki/regenerateEntryNotes'
import type { Entry, CardTemplate } from '@/types'

interface ResyncBody {
  formType?: string
  deckName?: string
  cardTypeId?: string
}

type EntryDoc = Partial<Entry> & {
  id: string
  anki_note_ids?: number[]
  card_type_ids?: string[]
}

export async function POST(request: Request) {
  try {
    const { formType, deckName, cardTypeId }: ResyncBody = await request.json().catch(() => ({}))
    const db = getAdminDb()

    // 1. Lấy các entry đã export, lọc trong bộ nhớ (tránh yêu cầu composite index).
    const snapshot = await db.collection('entries').where('status', '==', 'synced').get()
    const entries: EntryDoc[] = snapshot.docs
      .map(d => ({ id: d.id, ...(d.data() as Omit<EntryDoc, 'id'>) }))
      .filter(e => Array.isArray(e.anki_note_ids) && e.anki_note_ids.length > 0)
      .filter(e => !deckName || e.anki_deck === deckName)
      .filter(e => !formType || e.form_type === formType)
      .filter(e => !cardTypeId || (e.card_type_ids || []).includes(cardTypeId))

    if (entries.length === 0) {
      return NextResponse.json({ scanned: 0, updated: 0, skipped: 0, failed: 0, errors: [] })
    }

    // 2. Fetch 1 lượt mọi card type cần dùng (kèm template).
    const neededIds = [...new Set(entries.flatMap(e => e.card_type_ids || []))]
    const ctSnaps = await Promise.all(neededIds.map(id => db.collection('card_types').doc(id).get()))
    const cardTypeMap = new Map<string, CardTypeItem>()
    ctSnaps.forEach(s => {
      if (!s.exists) return
      const data = s.data() as { name?: string; code?: string; template?: CardTemplate }
      cardTypeMap.set(s.id, { id: s.id, name: data.name || s.id, code: data.code, template: data.template })
    })

    let updated = 0
    let skipped = 0
    let failed = 0
    const errors: string[] = []

    for (const entry of entries) {
      const noteIds = entry.anki_note_ids || []

      let infos
      try {
        infos = await flashcardService.notesInfo(noteIds)
      } catch (e) {
        failed += noteIds.length
        errors.push(`notesInfo failed for entry ${entry.id}: ${(e as Error).message}`)
        continue
      }
      const infoById = new Map(infos.map(n => [n.noteId, n]))

      const { updates, skipped: entrySkipped } = regenerateEntryNotes(entry, cardTypeMap, infoById, cardTypeId)
      skipped += entrySkipped

      for (const { noteId, fields } of updates) {
        try {
          await flashcardService.updateNoteFields(noteId, fields)
          updated += 1
        } catch (e) {
          failed += 1
          errors.push(`updateNoteFields failed for note ${noteId}: ${(e as Error).message}`)
        }
      }
    }

    return NextResponse.json({ scanned: entries.length, updated, skipped, failed, errors })
  } catch (error) {
    console.error('Resync Error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
