import { NextResponse } from 'next/server'
import { flashcardService } from '@/lib/flashcard-service'
import { getAdminDb } from '@/lib/firebase-admin'

export async function PUT(request: Request) {
  try {
    const { entryId, updates, noteUpdates } = await request.json()

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

    const ankiResults: { noteId: number; success: boolean; error?: string }[] = []

    if (noteUpdates && Array.isArray(noteUpdates)) {
      for (const { noteId, fields } of noteUpdates) {
        try {
          await flashcardService.updateNoteFields(noteId, fields)
          ankiResults.push({ noteId, success: true })
        } catch (e) {
          ankiResults.push({ noteId, success: false, error: (e as Error).message })
        }
      }
    }

    return NextResponse.json({ success: true, ankiResults })
  } catch (error) {
    console.error('Update entry error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
