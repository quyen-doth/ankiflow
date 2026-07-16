import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { provisionMock } = vi.hoisted(() => ({ provisionMock: vi.fn() }))

vi.mock('@/lib/account-provisioning', () => ({
  provisionUserAccount: provisionMock,
}))

import { POST } from '@/app/api/auth/signup/route'

function makeRequest(body: string): Request {
  return new Request('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })
}

beforeEach(() => {
  provisionMock.mockReset().mockResolvedValue({ uid: 'user-1', warnings: [] })
  vi.stubEnv('SIGNUP_ENABLED', 'false')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/auth/signup — public signup gate', () => {
  it('無効時は body を解析せず 403 を返す', async () => {
    const response = await POST(makeRequest('not-json'))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Sign-ups are currently closed' })
    expect(provisionMock).not.toHaveBeenCalled()
  })

  it('有効時は不正な入力を 400 で拒否する', async () => {
    vi.stubEnv('SIGNUP_ENABLED', 'true')

    const response = await POST(makeRequest(JSON.stringify({ email: 'invalid', password: 'short' })))

    expect(response.status).toBe(400)
    expect(provisionMock).not.toHaveBeenCalled()
  })

  it('有効時は user を provision して uid を返す', async () => {
    vi.stubEnv('SIGNUP_ENABLED', 'true')

    const response = await POST(makeRequest(JSON.stringify({
      email: 'user@example.com',
      password: 'Password1',
    })))

    expect(response.status).toBe(200)
    expect(provisionMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'Password1',
    })
    expect(await response.json()).toEqual({ success: true, uid: 'user-1' })
  })

  it('既存 email は 409 を返す', async () => {
    vi.stubEnv('SIGNUP_ENABLED', 'true')
    provisionMock.mockRejectedValueOnce(
      Object.assign(new Error('already exists'), { code: 'auth/email-already-exists' }),
    )

    const response = await POST(makeRequest(JSON.stringify({
      email: 'user@example.com',
      password: 'Password1',
    })))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: 'An account with this email already exists' })
  })
})
