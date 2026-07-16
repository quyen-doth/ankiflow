import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { getAdminAuthInstance } from '@/lib/firebase-admin'

/**
 * Firebase セッションクッキー `__session` (httpOnly) による API レイヤー認証。
 * Middleware はクッキーが「存在するか」のみをチェック (Edge は Admin SDK を
 * 実行できない) — 実際の署名検証 + revoked チェックはここで、リクエストごとに行われる。
 */
const SESSION_COOKIE_NAME = '__session'

type RouteContext = { params: Promise<Record<string, string>> }

export interface SessionUser {
  uid: string
  email?: string
}

/** session cookie を検証 → {uid, email}; 不足/不正/期限切れ/revoke 済みなら null。 */
export async function verifySessionUser(req: Request): Promise<SessionUser | null> {
  const cookieHeader = req.headers.get('cookie') || ''
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))
  const sessionCookie = match?.[1]
  if (!sessionCookie) return null
  try {
    // checkRevoked=true — logout が revokeRefreshTokens を呼ぶため古いクッキーは即座に無効化される
    const decoded = await getAdminAuthInstance().verifySessionCookie(sessionCookie, true)
    return { uid: decoded.uid, email: decoded.email }
  } catch {
    return null
  }
}

/** session cookie を検証 → uid; 無効なら null。 */
export async function verifySession(req: Request): Promise<string | null> {
  const user = await verifySessionUser(req)
  return user?.uid ?? null
}

/**
 * route handler を session verification でラップする。UID は第 3 引数として渡す
 * (request header は設定しない — Next route handler では request headers は immutable)。
 */
export function withAuth<Req extends Request = Request>(
  handler: (req: Req, ctx: RouteContext, uid: string) => Promise<Response>,
): (req: Req, ctx: RouteContext) => Promise<Response> {
  return async (req, ctx) => {
    const uid = await verifySession(req)
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return handler(req, ctx, uid)
  }
}

/** Admin control-plane route を session email + server-only ADMIN_EMAIL で fail-closed 保護する。 */
export function withAdmin<Req extends Request = Request>(
  handler: (req: Req, ctx: RouteContext, user: SessionUser) => Promise<Response>,
): (req: Req, ctx: RouteContext) => Promise<Response> {
  return async (req, ctx) => {
    const user = await verifySessionUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminEmail = process.env.ADMIN_EMAIL?.trim()
    if (!adminEmail || user.email !== adminEmail) {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
    }
    return handler(req, ctx, user)
  }
}

/**
 * Session cookie を使わない静的トークン比較 (integration/cron routes 向け)。
 * `timingSafeEqual` はバッファ長が異なると throw するため、長さチェックを先に行う
 * (タイミング攻撃対策 + クラッシュ防止)。
 */
export function verifyStaticToken(provided: string | null | undefined, expected: string | undefined): boolean {
  if (!expected || !provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
