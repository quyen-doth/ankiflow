import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock firebase-admin — verifySessionCookie (dùng bởi verifySessionUser) + Firestore doc get/set
const { verifyMock, docStore } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  docStore: new Map<string, Record<string, unknown>>(),
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuthInstance: () => ({ verifySessionCookie: verifyMock }),
  getAdminDb: () => ({
    collection: (name: string) => ({
      doc: (id: string) => {
        const key = `${name}/${id}`
        return {
          get: async () => ({
            exists: docStore.has(key),
            data: () => docStore.get(key),
          }),
          set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
            const prev = opts?.merge ? (docStore.get(key) ?? {}) : {}
            docStore.set(key, { ...prev, ...data })
          },
        }
      },
    }),
  }),
}))

import { GET, POST } from '@/app/api/admin/global-config/route'

const ORIGINAL_ADMIN_EMAIL = process.env.ADMIN_EMAIL

const makeReq = (opts: { cookie?: string; body?: unknown } = {}) => {
  const init: RequestInit = { headers: opts.cookie ? { cookie: opts.cookie } : {} }
  if (opts.body !== undefined) {
    init.method = 'POST'
    init.body = JSON.stringify(opts.body)
    init.headers = { ...init.headers, 'Content-Type': 'application/json' }
  }
  return new Request('http://localhost:3000/api/admin/global-config', init)
}

beforeEach(() => {
  verifyMock.mockReset()
  docStore.clear()
  process.env.ADMIN_EMAIL = 'owner@ankiflow.dev'
})

afterEach(() => {
  process.env.ADMIN_EMAIL = ORIGINAL_ADMIN_EMAIL
})

describe('GET /api/admin/global-config', () => {
  it('không session → 401', async () => {
    const res = await GET(makeReq())
    expect(res.status).toBe(401)
  })

  it('có session (không cần admin) → trả config hiện tại', async () => {
    verifyMock.mockResolvedValueOnce({ uid: 'u1', email: 'someone@else.com' })
    docStore.set('settings/global', { ai_model: 'claude-sonnet-4-6', tts_available: false })

    const res = await GET(makeReq({ cookie: '__session=ok' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ config: { ai_model: 'claude-sonnet-4-6', tts_available: false } })
  })

  it('doc chưa tồn tại → config: null (client tự fallback)', async () => {
    verifyMock.mockResolvedValueOnce({ uid: 'u1', email: 'someone@else.com' })
    const res = await GET(makeReq({ cookie: '__session=ok' }))
    expect(await res.json()).toEqual({ config: null })
  })
})

describe('POST /api/admin/global-config — chặn user thường (lỗ hổng cốt lõi cần vá)', () => {
  it('không session → 401, KHÔNG verify admin email', async () => {
    const res = await POST(makeReq({ body: { tts_available: false } }))
    expect(res.status).toBe(401)
  })

  it('user thường (email không khớp ADMIN_EMAIL) → 403, KHÔNG ghi Firestore', async () => {
    verifyMock.mockResolvedValueOnce({ uid: 'attacker', email: 'attacker@evil.com' })

    const res = await POST(makeReq({ cookie: '__session=ok', body: { ai_model: 'claude-opus-4-8' } }))

    expect(res.status).toBe(403)
    expect(docStore.has('settings/global')).toBe(false)
  })

  it('ADMIN_EMAIL chưa cấu hình (undefined) → mọi user đều 403 (fail-closed, không fail-open)', async () => {
    delete process.env.ADMIN_EMAIL
    verifyMock.mockResolvedValueOnce({ uid: 'u1', email: 'owner@ankiflow.dev' })

    const res = await POST(makeReq({ cookie: '__session=ok', body: { tts_available: false } }))

    expect(res.status).toBe(403)
  })
})

describe('POST /api/admin/global-config — admin hợp lệ', () => {
  it('admin đúng email → ghi thành công vào settings/global', async () => {
    verifyMock.mockResolvedValueOnce({ uid: 'admin1', email: 'owner@ankiflow.dev' })

    const res = await POST(
      makeReq({
        cookie: '__session=ok',
        body: { ai_model: 'claude-sonnet-4-6', web_search_enabled: true, tts_available: false, unsplash_available: true },
      }),
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    const saved = docStore.get('settings/global')
    expect(saved?.ai_model).toBe('claude-sonnet-4-6')
    expect(saved?.tts_available).toBe(false)
  })

  it('merge: chỉ gửi 1 field → các field khác trong doc giữ nguyên', async () => {
    docStore.set('settings/global', { ai_model: 'claude-haiku-4-5', tts_available: true, unsplash_available: true })
    verifyMock.mockResolvedValueOnce({ uid: 'admin1', email: 'owner@ankiflow.dev' })

    await POST(makeReq({ cookie: '__session=ok', body: { tts_available: false } }))

    const saved = docStore.get('settings/global')
    expect(saved?.tts_available).toBe(false)
    expect(saved?.ai_model).toBe('claude-haiku-4-5') // không bị xóa
    expect(saved?.unsplash_available).toBe(true)
  })

  it('body rỗng → 400, không ghi gì', async () => {
    verifyMock.mockResolvedValueOnce({ uid: 'admin1', email: 'owner@ankiflow.dev' })

    const res = await POST(makeReq({ cookie: '__session=ok', body: {} }))

    expect(res.status).toBe(400)
    expect(docStore.has('settings/global')).toBe(false)
  })

  it('body sai kiểu (zod reject) → 400', async () => {
    verifyMock.mockResolvedValueOnce({ uid: 'admin1', email: 'owner@ankiflow.dev' })

    const res = await POST(makeReq({ cookie: '__session=ok', body: { tts_available: 'yes' } }))

    expect(res.status).toBe(400)
  })
})
