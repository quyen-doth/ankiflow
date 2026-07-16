import { NextResponse } from 'next/server'
import { verifyStaticToken } from '@/lib/auth-guard'
import { GLOBAL_SETTINGS_DOC_ID } from '@/lib/constants'
import { getAdminDb } from '@/lib/firebase-admin'
import { buildReviewMessage } from '@/lib/line/flex-message'
import { pushMessage } from '@/lib/line/client'
import { currentHourInTimeZone } from '@/lib/notifications/schedule'
import { pickDueForReview } from '@/lib/srs/prioritize'
import type { Entry } from '@/types'

const DEFAULT_WORDS_PER_NOTIFICATION = 5
const MAX_CONCURRENCY = 5

interface GlobalLineSettings {
  line_notifications_available?: boolean
  line_schedule_hours?: number[]
  line_words_per_notification?: number
}

interface UserLineSettings {
  line_user_id?: string
  line_timezone?: string
  line_last_push_key?: string
}

interface FanOutResult {
  pushed: number
  skipped: number
  failed: number
}

function clampWordCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_WORDS_PER_NOTIFICATION
  }
  return Math.min(10, Math.max(1, Math.trunc(value)))
}

function scheduleHours(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (hour): hour is number => Number.isInteger(hour) && hour >= 0 && hour <= 23,
  )
}

/**
 * GET /api/cron/srs-push — GitHub Actions から毎時呼び出し、各 user の timezone と
 * 管理者設定の配信時刻に基づいて LINE 復習通知を送る。
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  if (!verifyStaticToken(bearer, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminDb()
  const globalSnapshot = await db.collection('settings').doc(GLOBAL_SETTINGS_DOC_ID).get()
  const globalSettings = (globalSnapshot.data() ?? {}) as GlobalLineSettings

  if (globalSettings.line_notifications_available === false) {
    return NextResponse.json({ pushed: 0, reason: 'disabled' })
  }

  const hours = scheduleHours(globalSettings.line_schedule_hours)
  if (hours.length === 0) {
    return NextResponse.json({ pushed: 0, reason: 'no schedule' })
  }

  const wordsPerNotification = clampWordCount(globalSettings.line_words_per_notification)
  const configuredToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!configuredToken) {
    return NextResponse.json({ error: 'LINE credentials not configured' }, { status: 500 })
  }
  const lineAccessToken = configuredToken

  const settingsSnapshot = await db
    .collection('settings')
    .where('line_notifications_enabled', '==', true)
    .get()
  const settingsDocuments = settingsSnapshot.docs
  const now = new Date()

  async function pushForUser(
    settingsDocument: (typeof settingsDocuments)[number],
  ): Promise<FanOutResult> {
    const uid = settingsDocument.id
    const userSettings = settingsDocument.data() as UserLineSettings
    const lineUserId = userSettings.line_user_id

    if (!lineUserId) return { pushed: 0, skipped: 1, failed: 0 }

    const { hour, key } = currentHourInTimeZone(now, userSettings.line_timezone)
    if (!hours.includes(hour) || userSettings.line_last_push_key === key) {
      return { pushed: 0, skipped: 1, failed: 0 }
    }

    try {
      const entriesSnapshot = await db
        .collection('entries')
        .where('user_id', '==', uid)
        .where('status', 'in', ['synced', 'reviewed'])
        .get()
      const entries: Entry[] = entriesSnapshot.docs.map(
        (document) => ({ id: document.id, ...document.data() }) as Entry,
      )
      const selected = pickDueForReview(entries, wordsPerNotification, now)

      if (selected.length === 0) return { pushed: 0, skipped: 1, failed: 0 }

      const result = await pushMessage(lineAccessToken, lineUserId, [buildReviewMessage(selected)])
      if (!result.success) {
        console.error(`[cron/srs-push] LINE push failed for user ${uid}:`, result.error)
        return { pushed: 0, skipped: 0, failed: 1 }
      }

      await db.collection('settings').doc(uid).update({ line_last_push_key: key })
      return { pushed: 1, skipped: 0, failed: 0 }
    } catch (error) {
      console.error(`[cron/srs-push] Failed for user ${uid}:`, error)
      return { pushed: 0, skipped: 0, failed: 1 }
    }
  }

  const total: FanOutResult = { pushed: 0, skipped: 0, failed: 0 }
  for (let index = 0; index < settingsDocuments.length; index += MAX_CONCURRENCY) {
    const chunk = settingsDocuments.slice(index, index + MAX_CONCURRENCY)
    const results = await Promise.all(chunk.map(pushForUser))
    for (const result of results) {
      total.pushed += result.pushed
      total.skipped += result.skipped
      total.failed += result.failed
    }
  }

  return NextResponse.json(total)
}
