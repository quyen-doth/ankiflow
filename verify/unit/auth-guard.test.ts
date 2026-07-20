import { beforeEach, describe, expect, it, vi } from 'vitest'

// 検証用コメント。
const { verifyMock } = vi.hoisted(() => ({ verifyMock: vi.fn() }))
vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuthInstance: () => ({ verifySessionCookie: verifyMock }),
}))

import { verifySession, verifySessionUser, withAuth } from '@/lib/auth-guard'

const makeReq = (cookie?: string) =>
  new Request('http://localhost:3000/api/test', {
    headers: cookie ? { cookie } : {},
  })

const ctx = { params: Promise.resolve({}) }

beforeEach(() => {
  verifyMock.mockReset()
})

describe('verifySession / verifySessionUser', () => {
  it('cookie がない → null、Admin SDK を呼ばない', async () => {
    await expect(verifySession(makeReq())).resolves.toBeNull()
    expect(verifyMock).not.toHaveBeenCalled()
  })

  it('cookie が有効 → uid + email、checkRevoked=true で検証', async () => {
    verifyMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.co' })

    const user = await verifySessionUser(makeReq('__session=valid-cookie; other=x'))

    expect(user).toEqual({ uid: 'u1', email: 'a@b.co' })
    expect(verifyMock).toHaveBeenCalledWith('valid-cookie', true)
  })

  it('cookie sai/revoked (verify throw) → null', async () => {
    verifyMock.mockRejectedValueOnce(new Error('session revoked'))
    await expect(verifySession(makeReq('__session=stale'))).resolves.toBeNull()
  })
})

describe('withAuth', () => {
  it('session がない → 401、handler は呼ばれない', async () => {
    const handler = vi.fn()
    const res = await withAuth(handler)(makeReq(), ctx)

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('session が有効 → handler は uid を第 3 引数として受け取る', async () => {
    verifyMock.mockResolvedValueOnce({ uid: 'u1', email: 'a@b.co' })
    const handler = vi.fn(async (_req: Request, _c: unknown, uid: string) =>
      new Response(JSON.stringify({ uid }), { status: 200 }),
    )

    const res = await withAuth(handler)(makeReq('__session=ok'), ctx)

    expect(res.status).toBe(200)
    expect(handler).toHaveBeenCalledOnce()
    expect(handler.mock.calls[0][2]).toBe('u1')
  })
})
