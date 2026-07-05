import { NextResponse } from 'next/server'
import { getAdminAuthInstance } from '@/lib/firebase-admin'

/**
 * API-layer auth bằng Firebase session cookie `__session` (httpOnly).
 * Middleware chỉ check cookie TỒN TẠI (Edge không chạy được Admin SDK) —
 * verify chữ ký + revoked THẬT SỰ diễn ra ở đây, trên mỗi request.
 */
const SESSION_COOKIE_NAME = '__session'

type RouteContext = { params: Promise<Record<string, string>> }

export interface SessionUser {
  uid: string
  email?: string
}

/** Verify session cookie → {uid, email}; null nếu thiếu/sai/hết hạn/đã revoke. */
export async function verifySessionUser(req: Request): Promise<SessionUser | null> {
  const cookieHeader = req.headers.get('cookie') || ''
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))
  const sessionCookie = match?.[1]
  if (!sessionCookie) return null
  try {
    // checkRevoked=true — logout gọi revokeRefreshTokens nên cookie cũ bị vô hiệu ngay
    const decoded = await getAdminAuthInstance().verifySessionCookie(sessionCookie, true)
    return { uid: decoded.uid, email: decoded.email }
  } catch {
    return null
  }
}

/** Verify session cookie → uid; null nếu không hợp lệ. */
export async function verifySession(req: Request): Promise<string | null> {
  const user = await verifySessionUser(req)
  return user?.uid ?? null
}

/**
 * Bọc route handler với session verification. UID truyền LÀM THAM SỐ THỨ 3
 * (KHÔNG set request header — request headers immutable trong Next route handler).
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
