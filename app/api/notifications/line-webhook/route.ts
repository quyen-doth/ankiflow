import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { replyMessage, verifySignatureAsync } from '@/lib/line/client'
import { LINE_LINK_CODE_REGEX, normalizeLineLinkCode } from '@/lib/line/link-code'
import { parsePostbackData, applyRating } from '@/lib/srs/webhook-handler'
import type { ReviewEvent, ReviewState, ReviewStateSnapshot } from '@/types'

function toSnapshot(state: ReviewState): ReviewStateSnapshot {
  return {
    queue: state.queue,
    interval_days: state.interval_days,
    ease_factor: state.ease_factor,
    due_date: state.due_date,
    lapses: state.lapses,
  }
}

interface LineWebhookEvent {
  type: string
  replyToken: string
  source?: { userId?: string }
  message?: { type: string; text?: string }
  postback?: { data: string }
}

interface LineWebhookBody {
  events: LineWebhookEvent[]
}

interface RatingResult {
  entryId: string
  rating: string
  success: boolean
}

type AdminDb = ReturnType<typeof getAdminDb>

async function replyText(replyToken: string, text: string): Promise<void> {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!channelAccessToken) {
    console.warn('LINE_CHANNEL_ACCESS_TOKEN not configured; skipping webhook reply')
    return
  }

  try {
    const result = await replyMessage(channelAccessToken, replyToken, [{ type: 'text', text }])
    if (!result.success) console.error('Failed to send LINE webhook reply:', result.error)
  } catch (error) {
    console.error('Failed to send LINE webhook reply:', error)
  }
}

async function handleLinkMessage(db: AdminDb, event: LineWebhookEvent): Promise<void> {
  if (event.message?.type !== 'text' || typeof event.message.text !== 'string') return

  const code = normalizeLineLinkCode(event.message.text)
  if (!LINE_LINK_CODE_REGEX.test(code)) return

  const codeRef = db.collection('line_link_codes').doc(code)
  const codeSnapshot = await codeRef.get()
  const codeData = codeSnapshot.data()
  const uid = typeof codeData?.uid === 'string' ? codeData.uid : null
  const expiresAt = typeof codeData?.expires_at === 'string' ? Date.parse(codeData.expires_at) : Number.NaN

  if (!codeSnapshot.exists || !uid) {
    await replyText(
      event.replyToken,
      'This link code is invalid or already used. Generate a new code in AnkiFlow Settings.',
    )
    return
  }

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await codeRef.delete()
    await replyText(
      event.replyToken,
      'This link code has expired. Generate a new code in AnkiFlow Settings.',
    )
    return
  }

  const lineUserId = event.source?.userId
  if (!lineUserId) {
    console.warn(`LINE link code ${code} did not include a source user ID`)
    return
  }

  const batch = db.batch()
  batch.set(db.collection('settings').doc(uid), {
    line_user_id: lineUserId,
    updated_at: new Date(),
  }, { merge: true })
  batch.delete(codeRef)
  await batch.commit()

  await replyText(
    event.replyToken,
    'Your LINE account is now linked to AnkiFlow ✅ Turn on reminders in Settings.',
  )
}

async function handleFollow(event: LineWebhookEvent): Promise<void> {
  await replyText(
    event.replyToken,
    'Welcome to AnkiFlow reminders! Open AnkiFlow → Settings → LINE Notifications → Generate link code, then send the code here.',
  )
}

async function handlePostback(db: AdminDb, event: LineWebhookEvent): Promise<RatingResult | null> {
  if (!event.postback) return null

  const parsed = parsePostbackData(event.postback.data)
  if (!parsed) return null

  try {
    const entryRef = db.collection('entries').doc(parsed.entry_id)
    const entrySnapshot = await entryRef.get()
    if (!entrySnapshot.exists) {
      return { entryId: parsed.entry_id, rating: parsed.rating, success: false }
    }

    const entryData = entrySnapshot.data()
    const ownerUid = typeof entryData?.user_id === 'string' ? entryData.user_id : null
    const sourceUserId = event.source?.userId
    if (!ownerUid || !sourceUserId) {
      console.warn(`Rejected LINE rating for ${parsed.entry_id}: missing ownership information`)
      return { entryId: parsed.entry_id, rating: parsed.rating, success: false }
    }

    const settingsSnapshot = await db.collection('settings').doc(ownerUid).get()
    if (settingsSnapshot.data()?.line_user_id !== sourceUserId) {
      console.warn(`Rejected LINE rating for ${parsed.entry_id}: account ownership mismatch`)
      return { entryId: parsed.entry_id, rating: parsed.rating, success: false }
    }

    const currentState = entryData?.review_state as ReviewState | undefined
    const newState = applyRating(currentState, parsed.rating)

    // 各 rating を append-only revlog に保存し、後続 sync で履歴が失われないようにする。
    const reviewEvent: ReviewEvent = {
      user_id: ownerUid,
      entry_id: parsed.entry_id,
      kind: 'rating',
      rating: parsed.rating,
      prev: currentState ? toSnapshot(currentState) : null,
      next: toSnapshot(newState),
      created_at: new Date().toISOString(),
    }

    await Promise.all([
      entryRef.update({ review_state: newState }),
      db.collection('review_events').add(reviewEvent),
    ])
    return { entryId: parsed.entry_id, rating: parsed.rating, success: true }
  } catch (error) {
    console.error(`Failed to process rating for ${parsed.entry_id}:`, error)
    return { entryId: parsed.entry_id, rating: parsed.rating, success: false }
  }
}

async function processEvent(db: AdminDb, event: LineWebhookEvent): Promise<RatingResult | null> {
  switch (event.type) {
    case 'message':
      await handleLinkMessage(db, event)
      return null
    case 'follow':
      await handleFollow(event)
      return null
    case 'postback':
      return handlePostback(db, event)
    default:
      return null
  }
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

  const body = JSON.parse(rawBody) as LineWebhookBody
  const db = getAdminDb()
  const eventResults = await Promise.all(body.events.map((event) => processEvent(db, event)))
  const results = eventResults.filter((result): result is RatingResult => result !== null)

  return NextResponse.json({ success: true, processed: results.length, results })
}
