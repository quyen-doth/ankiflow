import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminAuthInstance } from '@/lib/firebase-admin'

/**
 * Session cookie (httpOnly) — chiến lược auth chính của app:
 * - httpOnly → JS không đọc được → XSS không steal được token.
 * - SameSite Strict (production) → chống CSRF.
 * - Tên `__session` — Vercel chỉ forward cookie có prefix `__` qua CDN.
 * Xem flashcard/plans/firebase-auth-plan-2026-06-30.md.
 */
const SESSION_COOKIE_NAME = '__session'
const SESSION_EXPIRES_MS = 5 * 24 * 60 * 60 * 1000 // 5 ngày

const bodySchema = z.object({ idToken: z.string().min(1) })

/** POST — nhận ID token từ client vừa đăng nhập, đổi lấy session cookie. */
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
      // Strict trên production; Lax ở dev (localhost không cần strict, đỡ vướng khi dev)
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

/** DELETE — logout: revoke refresh tokens (vô hiệu session cookie ngay) + xóa cookie. */
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
      // Cookie không hợp lệ/hết hạn — vẫn tiếp tục xóa cookie phía client
    }
  }

  const res = NextResponse.json({ success: true })
  res.cookies.set(SESSION_COOKIE_NAME, '', { path: '/', maxAge: 0 })
  return res
}
