import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Route protection bằng session cookie `__session`.
 *
 * CHỈ kiểm tra cookie TỒN TẠI — không verify chữ ký (Firebase Admin SDK không chạy
 * được trên Edge Runtime). Verify thật sự diễn ra ở API routes (Phase C, withAuth).
 * Cookie giả/hết hạn sẽ qua được middleware nhưng bị API chặn 401.
 *
 * - Thiếu cookie: path `/api/*` → 401 JSON (KHÔNG redirect — client fetch nhận
 *   HTML redirect sẽ lỗi khó hiểu); page → redirect /login.
 * - Có cookie mà vào /login|/signup → redirect /dashboard.
 *
 * Matcher exclude (không qua middleware):
 * - `_next/*`, favicon, file tĩnh (có dấu chấm)
 * - `/api/auth/*` — login/signup/logout phải chạy được khi CHƯA có session
 * - `/api/notifications/line-webhook` — LINE platform gọi từ ngoài (không có cookie,
 *   tự bảo vệ bằng LINE signature verification)
 * - `/verify` — dev-only dashboard (production tự trả 404)
 */
const SESSION_COOKIE_NAME = '__session'
const AUTH_PAGES = ['/login', '/signup']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = !!request.cookies.get(SESSION_COOKIE_NAME)?.value
  const isAuthPage = AUTH_PAGES.includes(pathname)

  if (hasSession) {
    if (isAuthPage) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  if (isAuthPage) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth|api/notifications/line-webhook|verify|.*\\..*).*)',
  ],
}
