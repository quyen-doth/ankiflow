import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminDb } from '@/lib/firebase-admin'
import { verifySessionUser } from '@/lib/auth-guard'
import { GLOBAL_SETTINGS_DOC_ID } from '@/lib/constants'

/**
 * AI・media・LINE 通知のグローバル設定を管理する control plane。
 * GET は secret を含まず、POST は session cookie と admin email の両方で保護する。
 */
function isAdmin(email?: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL
  return !!adminEmail && email === adminEmail
}

export async function GET(request: Request) {
  const sessionUser = await verifySessionUser(request)
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const snap = await getAdminDb().collection('settings').doc(GLOBAL_SETTINGS_DOC_ID).get()
  return NextResponse.json({ config: snap.exists ? snap.data() : null })
}

const globalConfigSchema = z.object({
  ai_model: z.string().min(1).optional(),
  web_search_enabled: z.boolean().optional(),
  tts_available: z.boolean().optional(),
  unsplash_available: z.boolean().optional(),
  line_notifications_available: z.boolean().optional(),
  line_schedule_hours: z
    .array(z.number().int().min(0).max(23))
    .max(24)
    .transform((hours) => [...new Set(hours)].sort((a, b) => a - b))
    .optional(),
  line_words_per_notification: z.number().int().min(1).max(10).optional(),
})

export async function POST(request: Request) {
  const sessionUser = await verifySessionUser(request)
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdmin(sessionUser.email)) {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const parsed = globalConfigSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 })
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  await getAdminDb()
    .collection('settings')
    .doc(GLOBAL_SETTINGS_DOC_ID)
    .set({ ...parsed.data, updated_at: new Date() }, { merge: true })

  return NextResponse.json({ success: true })
}
