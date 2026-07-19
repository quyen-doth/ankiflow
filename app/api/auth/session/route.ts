import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminAuthInstance } from '@/lib/firebase-admin'

/**
 * Session cookie (httpOnly) — アプリの主要 auth 戦略:
 * - httpOnly → JS から読めない → XSS で token を盗めない。
 * - SameSite Strict (production) → CSRF 対策。
 * - 名前は `__session` — Vercel は `__` prefix の cookie のみ CDN 経由で forward する。
 * Xem flashcard/plans/firebase-auth-plan-2026-06-30.md.
 */
const SESSION_COOKIE_NAME = '__session'
const SESSION_EXPIRES_MS = 5 * 24 * 60 * 60 * 1000 // 5 日間

const bodySchema = z.object({ idToken: z.string().min(1) })

/** POST — ログイン直後の client から ID token を受け取り、session cookie と交換する。 */
export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })
    }

    const adminAuth = getAdminAuthInstance()
    const sessionCookie = await adminAuth.createSessionCookie(parsed.data.idToken, {
      expiresIn: SESSION_EXPIRES_MS,
    })

    const res = NextResponse.json({ success: true })
    res.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      // production は Strict; dev は Lax (localhost に strict は不要で、開発の邪魔になる)
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
      maxAge: SESSION_EXPIRES_MS / 1000,
    })
    return res
  } catch (error) {
    console.error('Create session error:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 401 })
  }
}

/** DELETE — logout: refresh tokens を revoke (session cookie を即無効化) + cookie 削除。 */
export async function DELETE(request: Request) {
  const cookieHeader = request.headers.get('cookie') || ''
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))
  const sessionCookie = match?.[1]

  if (sessionCookie) {
    try {
      const adminAuth = getAdminAuthInstance()
      const decoded = await adminAuth.verifySessionCookie(sessionCookie)
      await adminAuth.revokeRefreshTokens(decoded.sub)
    } catch {
      // cookie が無効/期限切れ — それでも client 側の cookie 削除は続行する
    }
  }

  const res = NextResponse.json({ success: true })
  res.cookies.set(SESSION_COOKIE_NAME, '', { path: '/', maxAge: 0 })
  return res
}
