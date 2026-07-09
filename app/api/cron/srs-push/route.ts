import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { verifyStaticToken } from '@/lib/auth-guard'
import { pushMessage } from '@/lib/line/client'
import { buildReviewMessage } from '@/lib/line/flex-message'
import { pickDueForReview } from '@/lib/srs/prioritize'
import type { Entry } from '@/types'

const PUSH_COUNT = 5

/**
 * GET /api/cron/srs-push — Vercel Cron gọi hằng ngày, tự động push nhắc ôn tập qua LINE
 * cho 1 user cố định (thay `scripts/send-notifications.ts` + GitHub Actions — bản cũ
 * KHÔNG filter user_id, rò rỉ dữ liệu chéo user; xem `.github/workflows/notify.yml`).
 * Auth: `Authorization: Bearer CRON_SECRET` (Vercel tự inject khi cấu hình qua vercel.json).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
  if (!verifyStaticToken(bearer, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const targetUid = process.env.SRS_PUSH_TARGET_UID ?? process.env.INTEGRATION_TARGET_UID
  if (!targetUid) {
    return NextResponse.json({ error: 'SRS_PUSH_TARGET_UID not configured' }, { status: 500 })
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const userId = process.env.LINE_USER_ID
  if (!token || !userId) {
    return NextResponse.json({ error: 'LINE credentials not configured' }, { status: 500 })
  }

  const db = getAdminDb()
  const snapshot = await db
    .collection('entries')
    .where('user_id', '==', targetUid)
    .where('status', 'in', ['synced', 'reviewed'])
    .get()

  if (snapshot.empty) {
    return NextResponse.json({ pushed: 0 })
  }

  const entries: Entry[] = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Entry)
  const selected = pickDueForReview(entries, PUSH_COUNT)

  if (selected.length === 0) {
    return NextResponse.json({ pushed: 0 })
  }

  const message = buildReviewMessage(selected)
  const result = await pushMessage(token, userId, [message])

  if (!result.success) {
    console.error('[cron/srs-push] LINE push failed:', result.error)
    return NextResponse.json({ error: result.error ?? 'LINE push failed' }, { status: 502 })
  }

  return NextResponse.json({
    pushed: selected.length,
    words: selected.map((e) => e.word ?? e.term ?? e.title),
  })
}
