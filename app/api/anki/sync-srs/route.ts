import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminDb } from '@/lib/firebase-admin'
import { withAuth } from '@/lib/auth-guard'
import type { ReviewState, SRSQueue } from '@/types'

const ANKI_QUEUE_MAP: Record<number, SRSQueue> = {
  0: 'new',
  1: 'learning',
  2: 'review',
  3: 'relearning',
}

/**
 * GET — trả danh sách anki_note_ids của các entry đã synced để CLIENT truy vấn Anki
 * (`findCards`/`cardsInfo`). Server KHÔNG đụng Anki (chạy được trên Vercel).
 */
export const GET = withAuth(async (_request, _ctx, uid) => {
  const db = getAdminDb()
  const snapshot = await db
    .collection('entries')
    .where('user_id', '==', uid)
    .where('status', '==', 'synced')
    .get()

  const noteIds = [
    ...new Set(
      snapshot.docs.flatMap((d) => ((d.data().anki_note_ids as number[] | undefined) || [])),
    ),
  ]

  return NextResponse.json({ noteIds })
})

// AnkiCardInfo do client gửi lên — chỉ validate các field dùng cho mapping.
const cardsSchema = z.object({
  cards: z.array(
    z.object({
      noteId: z.number(),
      interval: z.number(),
      ease: z.number(),
      due: z.number(),
      lapses: z.number(),
      queue: z.number(),
    }),
  ),
})

/**
 * POST — CLIENT gửi cardsInfo lấy từ Anki; server map sang ReviewState + batch update entries.
 * Logic map (ANKI_QUEUE_MAP, ease/interval/due) giữ nguyên như bản server-side cũ.
 */
export const POST = withAuth(async (request, _ctx, uid) => {
  try {
    const parsed = cardsSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 })
    }
    const { cards } = parsed.data

    const db = getAdminDb()
    const snapshot = await db
      .collection('entries')
      .where('user_id', '==', uid)
      .where('status', '==', 'synced')
      .get()

    interface EntryData {
      id: string
      anki_note_ids?: number[]
    }
    const entries: EntryData[] = snapshot.docs
      .map((d) => ({ id: d.id, anki_note_ids: d.data().anki_note_ids as number[] | undefined }))
      .filter((e) => e.anki_note_ids && e.anki_note_ids.length > 0)

    // Map noteId → ReviewState (giữ interval lớn nhất khi 1 note có nhiều card).
    const noteToSRS = new Map<number, ReviewState>()
    for (const card of cards) {
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
      const srsData = noteIds.map((id) => noteToSRS.get(id)).find(Boolean)
      if (!srsData) continue

      batch.update(db.collection('entries').doc(entry.id), { review_state: srsData })
      synced++
    }

    await batch.commit()

    return NextResponse.json({ success: true, synced, total: entries.length })
  } catch (error) {
    console.error('SRS sync error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
})
