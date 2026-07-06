import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminDb } from '@/lib/firebase-admin'
import { verifySessionUser } from '@/lib/auth-guard'
import { GLOBAL_SETTINGS_DOC_ID } from '@/lib/constants'

/**
 * Feature flags TOÀN CỤC (ai_model, web_search_enabled, tts_available, unsplash_available)
 * — control plane cho admin. GET không secret nên client thường cũng đọc trực tiếp qua
 * client SDK (GlobalConfigProvider); route này chủ yếu phục vụ POST — ghi PHẢI qua server,
 * verify admin bằng session cookie + email (client-side check trong UI chỉ là UX, không
 * phải bảo mật — user thường có thể tự gọi setDoc nếu không chặn ở đây).
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
