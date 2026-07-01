import { NextResponse } from 'next/server'
import { flashcardService } from '@/lib/flashcard-service'
import { getAdminDb } from '@/lib/firebase-admin'
import { regenerateEntryNotes } from '@/lib/anki/regenerateEntryNotes'
import { type CardTypeItem } from '@/lib/buildNotes'
import type { Entry, CardTemplate } from '@/types'

export async function PUT(request: Request) {
  try {
    const { entryId, updates } = await request.json()

    if (!entryId) {
      return NextResponse.json({ error: 'Missing entryId' }, { status: 400 })
    }

    const db = getAdminDb()

    if (updates && Object.keys(updates).length > 0) {
      await db.collection('entries').doc(entryId).update({
        ...updates,
        updated_at: new Date(),
      })
    }

    // Sinh lại note trong Anki theo template hiện tại (giữ media + SRS) — KHÔNG dùng HTML client gửi.
    const snap = await db.collection('entries').doc(entryId).get()
    const ankiResults: { noteId: number; success: boolean; error?: string }[] = []

    if (snap.exists) {
      const entry = { id: snap.id, ...(snap.data() as Partial<Entry> & { anki_note_ids?: number[]; card_type_ids?: string[] }) }
      const noteIds = entry.anki_note_ids || []

      if (noteIds.length > 0) {
        // Fetch card types (kèm template) + note hiện tại (để giữ media).
        const ctIds = [...new Set(entry.card_type_ids || [])]
        const [ctSnaps, infos] = await Promise.all([
          Promise.all(ctIds.map(id => db.collection('card_types').doc(id).get())),
          flashcardService.notesInfo(noteIds).catch(() => []),
        ])
        const cardTypeMap = new Map<string, CardTypeItem>()
        ctSnaps.forEach(s => {
          if (!s.exists) return
          const data = s.data() as { name?: string; code?: string; template?: CardTemplate }
          cardTypeMap.set(s.id, { id: s.id, name: data.name || s.id, code: data.code, template: data.template })
        })
        const infoById = new Map(infos.map(n => [n.noteId, n]))

        const { updates: noteUpdates } = regenerateEntryNotes(entry, cardTypeMap, infoById)
        for (const { noteId, fields } of noteUpdates) {
          try {
            await flashcardService.updateNoteFields(noteId, fields)
            ankiResults.push({ noteId, success: true })
          } catch (e) {
            ankiResults.push({ noteId, success: false, error: (e as Error).message })
          }
        }
      }
    }

    return NextResponse.json({ success: true, ankiResults })
  } catch (error) {
    console.error('Update entry error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
