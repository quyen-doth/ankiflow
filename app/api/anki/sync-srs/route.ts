import { NextResponse } from 'next/server'
import { flashcardService } from '@/lib/flashcard-service'
import { getAdminDb } from '@/lib/firebase-admin'
import type { ReviewState, SRSQueue } from '@/types'

const ANKI_QUEUE_MAP: Record<number, SRSQueue> = {
  0: 'new',
  1: 'learning',
  2: 'review',
  3: 'relearning',
}

export async function POST() {
  try {
    const db = getAdminDb()
    const snapshot = await db.collection('entries')
      .where('status', '==', 'synced')
      .get()

    if (snapshot.empty) {
      return NextResponse.json({ success: true, synced: 0, message: 'No synced entries found' })
    }

    interface EntryData {
      id: string
      anki_note_ids?: number[]
      [key: string]: unknown
    }

    const entries: EntryData[] = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }) as EntryData)
      .filter(e => e.anki_note_ids && e.anki_note_ids.length > 0)

    if (entries.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: 'No entries with Anki note IDs' })
    }

    const allNoteIds = entries.flatMap(e => e.anki_note_ids!)
    const noteIdSet = new Set(allNoteIds)

    const allCardIds: number[] = []
    for (const noteId of noteIdSet) {
      const cards = await flashcardService.findCards(`nid:${noteId}`)
      allCardIds.push(...cards)
    }

    if (allCardIds.length === 0) {
      return NextResponse.json({ success: true, synced: 0, message: 'No cards found in Anki' })
    }

    const cardsInfo = await flashcardService.cardsInfo(allCardIds)

    const noteToSRS = new Map<number, ReviewState>()
    for (const card of cardsInfo) {
      const existing = noteToSRS.get(card.noteId)
      if (existing && existing.interval_days > (card.interval ?? 0)) continue

      const dueDate = new Date(card.due * 1000)
      const queue = ANKI_QUEUE_MAP[card.queue] ?? 'review'

      noteToSRS.set(card.noteId, {
        ease_factor: Math.round((card.ease / 1000) * 100) / 100,
        interval_days: card.interval,
        due_date: dueDate.toISOString(),
        lapses: card.lapses,
        total_reviews: 0,
        last_reviewed_at: '',
        last_rating: 'good',
        queue,
        learning_step: 0,
        source: 'anki_sync',
        synced_at: new Date().toISOString(),
      })
    }

    const batch = db.batch()
    let synced = 0
    for (const entry of entries) {
      const noteIds = entry.anki_note_ids!
      const srsData = noteIds.map(id => noteToSRS.get(id)).find(Boolean)
      if (!srsData) continue

      batch.update(db.collection('entries').doc(entry.id), {
        review_state: srsData,
      })
      synced++
    }

    await batch.commit()

    return NextResponse.json({ success: true, synced, total: entries.length })
  } catch (error) {
    console.error('SRS sync error:', error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
