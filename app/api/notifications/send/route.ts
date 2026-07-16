import { NextResponse } from 'next/server'
import { verifySessionUser } from '@/lib/auth-guard'
import { GLOBAL_SETTINGS_DOC_ID } from '@/lib/constants'
import { getAdminDb } from '@/lib/firebase-admin'
import { buildReviewMessage } from '@/lib/line/flex-message'
import { pushMessage } from '@/lib/line/client'
import { createDefaultReviewState } from '@/lib/srs/fsrs'
import { pickDueForReview } from '@/lib/srs/prioritize'
import type { Entry } from '@/types'

const TEST_NOTIFICATION_COOLDOWN_MS = 60 * 1000

interface GlobalLineSettings {
  line_notifications_available?: boolean
  line_words_per_notification?: number
}

interface UserLineSettings {
  line_user_id?: string
  line_last_test_at?: unknown
}

function clampWordCount(value: unknown, fallback: number): number {
  const count = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(10, Math.max(1, Math.trunc(count)))
}

function timestampToMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    const toMillis = (value as { toMillis?: unknown }).toMillis
    if (typeof toMillis === 'function') {
      const parsed = toMillis.call(value)
      return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null
    }
  }
  return null
}

/**
 * 認証済み user の連携先 LINE アカウントへ、復習通知を即時送信する。
 */
export async function POST(request: Request) {
  const sessionUser = await verifySessionUser(request)
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const db = getAdminDb()
  const [globalSnapshot, userSettingsSnapshot] = await Promise.all([
    db.collection('settings').doc(GLOBAL_SETTINGS_DOC_ID).get(),
    db.collection('settings').doc(sessionUser.uid).get(),
  ])
  const globalSettings = (globalSnapshot.data() ?? {}) as GlobalLineSettings

  if (globalSettings.line_notifications_available === false) {
    return NextResponse.json(
      { error: 'LINE notifications are disabled by administrator' },
      { status: 403 },
    )
  }

  const userSettings = (userSettingsSnapshot.data() ?? {}) as UserLineSettings
  const lineUserId = userSettings.line_user_id
  if (!lineUserId) {
    return NextResponse.json(
      { error: 'Link your LINE account in Settings first' },
      { status: 400 },
    )
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'LINE credentials not configured' }, { status: 500 })
  }

  const rawBody: unknown = await request.json().catch(() => ({}))
  const body =
    typeof rawBody === 'object' && rawBody !== null
      ? (rawBody as Record<string, unknown>)
      : {}
  const deckFilter = Array.isArray(body.deck_filter)
    ? body.deck_filter.filter((value: unknown): value is string => typeof value === 'string')
    : []
  const languageFilter = Array.isArray(body.language_filter)
    ? body.language_filter.filter((value: unknown): value is string => typeof value === 'string')
    : []
  const defaultCount = clampWordCount(globalSettings.line_words_per_notification, 5)
  const count = clampWordCount(body.count, defaultCount)

  const now = new Date()
  const nowISO = now.toISOString()

  const snapshot = await db.collection('entries')
    .where('user_id', '==', sessionUser.uid)
    .where('status', 'in', ['synced', 'reviewed'])
    .get()

  if (snapshot.empty) {
    return NextResponse.json({ success: true, sent: 0, message: 'No synced entries' })
  }

  let entries: Entry[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Entry)

  if (deckFilter.length > 0) {
    entries = entries.filter(e => deckFilter.includes(e.anki_deck))
  }
  if (languageFilter.length > 0) {
    entries = entries.filter(e => e.language && languageFilter.includes(e.language))
  }

  const selected = pickDueForReview(entries, count, now)

  if (selected.length === 0) {
    return NextResponse.json({ success: true, sent: 0, message: 'No entries due for review' })
  }

  const settingsRef = db.collection('settings').doc(sessionUser.uid)
  const claimTime = new Date()
  const claim = await db.runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(settingsRef)
    const currentSettings = (currentSnapshot.data() ?? {}) as UserLineSettings
    const currentLineUserId = currentSettings.line_user_id
    if (!currentLineUserId) return { status: 'unlinked' as const }

    const lastTestAt = timestampToMillis(currentSettings.line_last_test_at)
    const elapsed = lastTestAt === null ? TEST_NOTIFICATION_COOLDOWN_MS : claimTime.getTime() - lastTestAt
    if (elapsed < TEST_NOTIFICATION_COOLDOWN_MS) {
      return {
        status: 'cooldown' as const,
        retryAfterSeconds: Math.max(1, Math.ceil((TEST_NOTIFICATION_COOLDOWN_MS - elapsed) / 1000)),
      }
    }

    transaction.update(settingsRef, { line_last_test_at: claimTime })
    return { status: 'claimed' as const, lineUserId: currentLineUserId }
  })

  if (claim.status === 'unlinked') {
    return NextResponse.json(
      { error: 'Link your LINE account in Settings first' },
      { status: 400 },
    )
  }
  if (claim.status === 'cooldown') {
    return NextResponse.json(
      {
        error: `Please wait ${claim.retryAfterSeconds} seconds before sending another test notification`,
        retry_after_seconds: claim.retryAfterSeconds,
      },
      { status: 429, headers: { 'Retry-After': String(claim.retryAfterSeconds) } },
    )
  }

  for (const entry of selected) {
    if (!entry.review_state) {
      entry.review_state = createDefaultReviewState(nowISO)
    }
  }

  const message = buildReviewMessage(selected)
  const result = await pushMessage(token, claim.lineUserId, [message])

  if (!result.success) {
    console.error('LINE push failed:', result.error)
    return NextResponse.json({
      error: result.error ?? 'LINE push failed',
    }, { status: 502 })
  }

  return NextResponse.json({
    success: true,
    sent: selected.length,
    words: selected.map(e => e.word ?? e.term ?? e.title),
  })
}
