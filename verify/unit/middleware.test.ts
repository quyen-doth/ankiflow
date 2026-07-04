import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

const BASE = 'http://localhost:3000'

function makeRequest(path: string, withCookie = false): NextRequest {
  return new NextRequest(`${BASE}${path}`, {
    headers: withCookie ? { cookie: '__session=fake-session-cookie' } : {},
  })
}

describe('middleware — chưa có session cookie', () => {
  it('page → redirect /login', () => {
    const res = middleware(makeRequest('/dashboard'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(`${BASE}/login`)
  })

  it('root / → redirect /login', () => {
    const res = middleware(makeRequest('/'))
    expect(res.headers.get('location')).toBe(`${BASE}/login`)
  })

  it('API route → 401 JSON, KHÔNG redirect (client fetch cần status rõ ràng)', async () => {
    const res = middleware(makeRequest('/api/history'))
    expect(res.status).toBe(401)
    expect(res.headers.get('location')).toBeNull()
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('/login và /signup vẫn truy cập được', () => {
    for (const path of ['/login', '/signup']) {
      const res = middleware(makeRequest(path))
      expect(res.status, path).toBe(200)
      expect(res.headers.get('location'), path).toBeNull()
    }
  })
})

describe('middleware — đã có session cookie', () => {
  it('page thường đi qua bình thường', () => {
    const res = middleware(makeRequest('/dashboard', true))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('API route đi qua (verify thật ở API layer — Phase C)', () => {
    const res = middleware(makeRequest('/api/history', true))
    expect(res.status).toBe(200)
  })

  it('vào /login khi đã đăng nhập → redirect /dashboard', () => {
    const res = middleware(makeRequest('/login', true))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(`${BASE}/dashboard`)
  })
})

describe('middleware — matcher exclusions (regex trong config)', () => {
  // Matcher là path-to-regexp string — kiểm tra regex loại đúng các path ngoại lệ
  const pattern = new RegExp(
    '^/(?!_next/static|_next/image|favicon.ico|api/auth|api/notifications/line-webhook|verify|.*\\..*).*$',
  )

  it('exclude: api/auth, line-webhook, verify, static files', () => {
    for (const path of [
      '/api/auth/session',
      '/api/auth/signup',
      '/api/notifications/line-webhook',
      '/verify',
      '/verify/Badge/basic',
      '/favicon.ico',
      '/_next/static/chunk.js',
      '/logo.png',
    ]) {
      expect(pattern.test(path), path).toBe(false)
    }
  })

  it('include: pages + API cần bảo vệ', () => {
    for (const path of ['/', '/dashboard', '/login', '/api/history', '/api/entries/sync', '/api/generate']) {
      expect(pattern.test(path), path).toBe(true)
    }
  })
})
