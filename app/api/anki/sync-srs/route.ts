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
 * GET — synced 済み entry の anki_note_ids 一覧を返し、CLIENT が Anki を照会する
 * (`findCards`/`cardsInfo`)。Server は Anki に触れない (Vercel で動作可能)。
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

// client から送られる AnkiCardInfo — mapping に使う field のみ validate する。
// mod/reps は optional: 旧 AnkiConnect は返さない (client は raw cardsInfo を POST、変更不要)。
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
 * Precedence guard (SRS Phase 0): より新しい内部進捗を上書きしない。
 * - `source === 'builtin'` = LINE 経由で rate 済みの entry (内部 SM-2)。
 * - `mod` あり (unix 秒、Anki 側の最終活動時刻): 内部 rating が mod より新しければ skip。
 * - `mod` なし (旧 AnkiConnect): 前回 sync (`synced_at`) より後に rate 済みなら skip —
 *   LINE の進捗を失わない方向に倒す (synced_at 空 = 未 sync → こちらも skip)。
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

/** `anki_sync` event は state が実際に変わった時だけ記録 — sync 連打による noise を防ぐ。 */
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
 * map ロジック (ANKI_QUEUE_MAP、ease/interval/due) は旧 server-side 版のまま維持。
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

    // noteId → ReviewState を map (1 note 複数 card の場合は最大 interval を採用)。
    // noteToMod は note に属する全 card の最大 mod (Anki 側の最終活動時刻) を保持
    // — precedence guard 用で、どの card が state に選ばれたかに依存しない。
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
    // 500 ops 制限があるため、単一 batch では entries が多いと破綻する。
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

      // Precedence guard: 内部 (LINE) の rate 進捗が Anki の活動より新しい → 維持する。
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

      // Revlog: state が実際に変わった時だけ event を記録。
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
