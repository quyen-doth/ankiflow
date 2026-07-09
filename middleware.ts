import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * セッションクッキー `__session` によるルート保護。
 *
 * クッキーが「存在するか」のみをチェック — 署名は検証しない (Firebase Admin SDK は
 * Edge Runtime 上で実行できないため)。実際の検証は API routes (Phase C、withAuth) で
 * 行われる。偽造/期限切れのクッキーは middleware を通過するが、API 側で 401 で
 * ブロックされる。
 *
 * - クッキーがない場合: `/api/*` パス → 401 JSON (redirect しない — client fetch が
 *   HTML redirect を受け取ると分かりにくいエラーになるため); page → /login へ redirect。
 * - クッキーがある状態で /login|/signup にアクセス → /dashboard へ redirect。
 *
 * Matcher exclude (middleware を通らない):
 * - `_next/*`、favicon、静的ファイル (ドット付き)
 * - `/api/auth/*` — セッションがまだない状態でも login/signup/logout は実行できる必要がある
 * - `/api/notifications/line-webhook` — LINE プラットフォームが外部から呼び出す
 *   (クッキーを持たない、LINE signature verification で自己防御)
 * - `/api/integrations/*` — 外部システム (Knowledge Hub) が呼び出す。クッキーを持たない、
 *   `x-integration-token` ヘッダーで自己防御
 * - `/api/cron/*` — Vercel Cron が呼び出す。クッキーを持たない、
 *   `Authorization: Bearer CRON_SECRET` で自己防御
 * - `/verify` — dev-only ダッシュボード (production では自動的に 404)
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
    '/((?!_next/static|_next/image|favicon.ico|api/auth|api/notifications/line-webhook|api/integrations|api/cron|verify|.*\\..*).*)',
  ],
}
