import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'

const BASE = 'http://localhost:3000'

function makeRequest(path: string, withCookie = false): NextRequest {
  return new NextRequest(`${BASE}${path}`, {
    headers: withCookie ? { cookie: '__session=fake-session-cookie' } : {},
  })
}

describe('middleware — session cookie がない場合', () => {
  it('page → redirect /login', () => {
    const res = middleware(makeRequest('/dashboard'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(`${BASE}/login`)
  })

  it('root / → redirect /login', () => {
    const res = middleware(makeRequest('/'))
    expect(res.headers.get('location')).toBe(`${BASE}/login`)
  })

  it('API route → 401 JSON、redirect しない (client fetch には明確な status が必要)', async () => {
    const res = middleware(makeRequest('/api/history'))
    expect(res.status).toBe(401)
    expect(res.headers.get('location')).toBeNull()
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('/login と /signup はアクセス可能', () => {
    for (const path of ['/login', '/signup']) {
      const res = middleware(makeRequest(path))
      expect(res.status, path).toBe(200)
      expect(res.headers.get('location'), path).toBeNull()
    }
  })
})

describe('middleware — session cookie がある場合', () => {
  it('通常の page は正常に通過', () => {
    const res = middleware(makeRequest('/dashboard', true))
    expect(res.status).toBe(200)
    expect(res.headers.get('location')).toBeNull()
  })

  it('API route は通過する (実際の検証は API layer — Phase C)', () => {
    const res = middleware(makeRequest('/api/history', true))
    expect(res.status).toBe(200)
  })

  it('ログイン済みで /login にアクセス → /dashboard へ redirect', () => {
    const res = middleware(makeRequest('/login', true))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe(`${BASE}/dashboard`)
  })
})

describe('middleware — matcher exclusions (regex trong config)', () => {
  // 検証用コメント。
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

  it('include: 保護が必要な pages + API', () => {
    for (const path of ['/', '/dashboard', '/login', '/api/history', '/api/entries/sync', '/api/generate']) {
      expect(pattern.test(path), path).toBe(true)
    }
  })
})
