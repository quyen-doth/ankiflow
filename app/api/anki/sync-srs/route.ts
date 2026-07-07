import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminDb } from '@/lib/firebase-admin'
import { withAuth } from '@/lib/auth-guard'
import type { ReviewEvent, ReviewState, ReviewStateSnapshot, SRSQueue } from '@/types'

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
// mod/reps optional: AnkiConnect cũ không trả (client POST raw cardsInfo, không cần đổi).
const cardsSchema = z.object({
  cards: z.array(
    z.object({
      noteId: z.number(),
      interval: z.number(),
      ease: z.number(),
      due: z.number(),
      lapses: z.number(),
      queue: z.number(),
      mod: z.number().optional(),
      reps: z.number().optional(),
    }),
  ),
})

/**
 * Precedence guard (SRS Phase 0): KHÔNG ghi đè tiến độ nội bộ mới hơn.
 * - `source === 'builtin'` = entry đã được rate qua LINE (SM-2 nội bộ).
 * - Có `mod` (unix giây, lần hoạt động cuối bên Anki): skip nếu rating nội bộ MỚI HƠN mod.
 * - Không có `mod` (AnkiConnect cũ): skip nếu đã rate SAU lần sync trước (`synced_at`) —
 *   thiên về KHÔNG mất tiến độ LINE (synced_at rỗng = chưa từng sync → cũng skip).
 */
function shouldSkipOverwrite(current: ReviewState | undefined, ankiModSeconds: number | undefined): boolean {
  if (!current || current.source !== 'builtin') return false
  const ratedAt = Date.parse(current.last_reviewed_at)
  if (Number.isNaN(ratedAt)) return false
  if (ankiModSeconds !== undefined) {
    return ratedAt > ankiModSeconds * 1000
  }
  const syncedAt = Date.parse(current.synced_at)
  return Number.isNaN(syncedAt) || ratedAt > syncedAt
}

/** Event `anki_sync` chỉ ghi khi state thực sự đổi — tránh noise mỗi lần bấm sync. */
function stateChanged(current: ReviewState | undefined, next: ReviewState): boolean {
  if (!current) return true
  return (
    current.due_date !== next.due_date ||
    current.interval_days !== next.interval_days ||
    current.lapses !== next.lapses ||
    current.queue !== next.queue
  )
}

function toSnapshot(s: ReviewState): ReviewStateSnapshot {
  return {
    queue: s.queue,
    interval_days: s.interval_days,
    ease_factor: s.ease_factor,
    due_date: s.due_date,
    lapses: s.lapses,
  }
}

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
      review_state?: ReviewState
    }
    const entries: EntryData[] = snapshot.docs
      .map((d) => ({
        id: d.id,
        anki_note_ids: d.data().anki_note_ids as number[] | undefined,
        review_state: d.data().review_state as ReviewState | undefined,
      }))
      .filter((e) => e.anki_note_ids && e.anki_note_ids.length > 0)

    // Map noteId → ReviewState (giữ interval lớn nhất khi 1 note có nhiều card).
    // noteToMod giữ mod LỚN NHẤT của mọi card thuộc note (lần hoạt động cuối bên Anki)
    // — dùng cho precedence guard, không phụ thuộc card nào được chọn làm state.
    const noteToSRS = new Map<number, ReviewState>()
    const noteToMod = new Map<number, number>()
    for (const card of cards) {
      if (card.mod !== undefined) {
        const prevMod = noteToMod.get(card.noteId)
        if (prevMod === undefined || card.mod > prevMod) noteToMod.set(card.noteId, card.mod)
      }

      const existing = noteToSRS.get(card.noteId)
      if (existing && existing.interval_days > (card.interval ?? 0)) continue

      const dueDate = new Date(card.due * 1000)
      const queue = ANKI_QUEUE_MAP[card.queue] ?? 'review'

      noteToSRS.set(card.noteId, {
        ease_factor: Math.round((card.ease / 1000) * 100) / 100,
        interval_days: card.interval,
        due_date: dueDate.toISOString(),
        lapses: card.lapses,
        total_reviews: card.reps ?? 0,
        last_reviewed_at: '',
        last_rating: 'good',
        queue,
        learning_step: 0,
        source: 'anki_sync',
        synced_at: new Date().toISOString(),
      })
    }

    // Gom ops rồi commit theo chunk — update + event = 2 ops/entry, batch Firestore
    // giới hạn 500 ops nên 1 batch duy nhất sẽ vỡ khi nhiều entries.
    interface PendingOp {
      ref: FirebaseFirestore.DocumentReference
      data: FirebaseFirestore.DocumentData
      isCreate: boolean
    }
    const ops: PendingOp[] = []
    const nowISO = new Date().toISOString()
    let synced = 0
    let skipped = 0

    for (const entry of entries) {
      const noteIds = entry.anki_note_ids!
      const matchedNoteId = noteIds.find((id) => noteToSRS.has(id))
      if (matchedNoteId === undefined) continue
      const srsData = noteToSRS.get(matchedNoteId)!
      const ankiMod = noteToMod.get(matchedNoteId)

      // Precedence guard: tiến độ rate nội bộ (LINE) mới hơn hoạt động Anki → giữ nguyên.
      if (shouldSkipOverwrite(entry.review_state, ankiMod)) {
        skipped++
        continue
      }

      ops.push({
        ref: db.collection('entries').doc(entry.id),
        data: { review_state: srsData },
        isCreate: false,
      })
      synced++

      // Revlog: chỉ ghi event khi state thực sự đổi.
      if (stateChanged(entry.review_state, srsData)) {
        const event: ReviewEvent = {
          user_id: uid,
          entry_id: entry.id,
          kind: 'anki_sync',
          prev: entry.review_state ? toSnapshot(entry.review_state) : null,
          next: toSnapshot(srsData),
          created_at: nowISO,
        }
        ops.push({ ref: db.collection('review_events').doc(), data: event, isCreate: true })
      }
    }

    const BATCH_LIMIT = 400
    const commits: Promise<FirebaseFirestore.WriteResult[]>[] = []
    for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
      const batch = db.batch()
      for (const op of ops.slice(i, i + BATCH_LIMIT)) {
        if (op.isCreate) batch.set(op.ref, op.data)
        else batch.update(op.ref, op.data)
      }
      commits.push(batch.commit())
    }
    await Promise.all(commits)

    return NextResponse.json({ success: true, synced, skipped, total: entries.length })
  } catch (error) {
    console.error('SRS sync error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
})
