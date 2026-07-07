import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { verifySignatureAsync } from '@/lib/line/client'
import { parsePostbackData, applyRating } from '@/lib/srs/webhook-handler'
import type { ReviewEvent, ReviewState, ReviewStateSnapshot } from '@/types'

function toSnapshot(s: ReviewState): ReviewStateSnapshot {
  return {
    queue: s.queue,
    interval_days: s.interval_days,
    ease_factor: s.ease_factor,
    due_date: s.due_date,
    lapses: s.lapses,
  }
}

interface LineWebhookEvent {
  type: string
  replyToken: string
  postback?: { data: string }
}

interface LineWebhookBody {
  events: LineWebhookEvent[]
}

export async function POST(request: Request) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET
  if (!channelSecret) {
    return NextResponse.json({ error: 'LINE_CHANNEL_SECRET not configured' }, { status: 500 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-line-signature') ?? ''

  const valid = await verifySignatureAsync(channelSecret, rawBody, signature)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const body: LineWebhookBody = JSON.parse(rawBody)
  const db = getAdminDb()
  const results: { entryId: string; rating: string; success: boolean }[] = []

  for (const event of body.events) {
    if (event.type !== 'postback' || !event.postback) continue

    const parsed = parsePostbackData(event.postback.data)
    if (!parsed) continue

    try {
      const entryRef = db.collection('entries').doc(parsed.entry_id)
      const entrySnap = await entryRef.get()
      if (!entrySnap.exists) {
        results.push({ entryId: parsed.entry_id, rating: parsed.rating, success: false })
        continue
      }

      const entryData = entrySnap.data()
      const currentState = entryData?.review_state as ReviewState | undefined
      const newState = applyRating(currentState, parsed.rating)

      // Revlog (SRS Phase 0): mỗi rating là 1 event append-only — lịch sử review
      // không mất khi review_state bị sync-srs ghi đè sau này.
      const event: ReviewEvent = {
        user_id: (entryData?.user_id as string | undefined) ?? '',
        entry_id: parsed.entry_id,
        kind: 'rating',
        rating: parsed.rating,
        prev: currentState ? toSnapshot(currentState) : null,
        next: toSnapshot(newState),
        created_at: new Date().toISOString(),
      }

      await Promise.all([
        entryRef.update({ review_state: newState }),
        db.collection('review_events').add(event),
      ])
      results.push({ entryId: parsed.entry_id, rating: parsed.rating, success: true })
    } catch (error) {
      console.error(`Failed to process rating for ${parsed.entry_id}:`, error)
      results.push({ entryId: parsed.entry_id, rating: parsed.rating, success: false })
    }
  }

  return NextResponse.json({ success: true, processed: results.length, results })
}
