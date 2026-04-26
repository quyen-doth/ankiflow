import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

type RouteHandler = (req: NextRequest, ctx: any) => Promise<NextResponse>

export function withAuthGuard(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    // TODO: Nâng cấp lên Firebase Auth khi chuyển sang multi-user (Phase 3)
    const secret = req.headers.get('x-api-secret')
    if (!secret || secret !== process.env.API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return handler(req, ctx)
  }
}
