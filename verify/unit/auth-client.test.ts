import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock firebase/auth — kiểm soát signIn/signOut của Firebase client SDK
const { signInMock, signOutMock } = vi.hoisted(() => ({
  signInMock: vi.fn(),
  signOutMock: vi.fn(async () => {}),
}))
vi.mock('firebase/auth', () => ({
  getAuth: () => ({}),
  signInWithEmailAndPassword: signInMock,
  signOut: signOutMock,
}))

import { signIn, signUp, logout, clearLocalData, emailSchema, passwordSchema } from '@/lib/auth'

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    handler(String(input), init),
  )
  vi.stubGlobal('fetch', mock)
  return mock
}

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  signInMock.mockReset()
  signOutMock.mockClear()
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('password/email schemas', () => {
  it('password: cần ≥8 ký tự, 1 hoa, 1 số', () => {
    expect(passwordSchema.safeParse('Abcdef12').success).toBe(true)
    expect(passwordSchema.safeParse('short1A').success).toBe(false) // 7 ký tự
    expect(passwordSchema.safeParse('abcdefg1').success).toBe(false) // thiếu hoa
    expect(passwordSchema.safeParse('Abcdefgh').success).toBe(false) // thiếu số
  })

  it('email: reject chuỗi không phải email', () => {
    expect(emailSchema.safeParse('a@b.co').success).toBe(true)
    expect(emailSchema.safeParse('not-an-email').success).toBe(false)
  })
})

describe('signIn', () => {
  it('happy path: Firebase sign-in → POST idToken → ok', async () => {
    signInMock.mockResolvedValueOnce({ user: { getIdToken: async () => 'token-123' } })
    const fetchMock = stubFetch(() => jsonRes({ success: true }))

    const result = await signIn('a@b.co', 'Abcdef12')

    expect(result).toEqual({ ok: true })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/auth/session')
    expect(JSON.parse(init.body as string)).toEqual({ idToken: 'token-123' })
  })

  it('sai mật khẩu → thông điệp thân thiện, không lộ mã lỗi', async () => {
    signInMock.mockRejectedValueOnce({ code: 'auth/invalid-credential' })

    const result = await signIn('a@b.co', 'wrong')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('Incorrect email or password')
  })

  it('session route fail → ok:false với error từ server', async () => {
    signInMock.mockResolvedValueOnce({ user: { getIdToken: async () => 't' } })
    stubFetch(() => jsonRes({ error: 'Failed to create session' }, 401))

    const result = await signIn('a@b.co', 'Abcdef12')

    expect(result).toEqual({ ok: false, error: 'Failed to create session' })
  })
})

describe('signUp', () => {
  it('signup thành công → tự động signIn', async () => {
    signInMock.mockResolvedValueOnce({ user: { getIdToken: async () => 't' } })
    const fetchMock = stubFetch((url) =>
      url === '/api/auth/signup' ? jsonRes({ success: true, uid: 'u1' }) : jsonRes({ success: true }),
    )

    const result = await signUp('a@b.co', 'Abcdef12')

    expect(result).toEqual({ ok: true })
    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls).toEqual(['/api/auth/signup', '/api/auth/session'])
  })

  it('email đã tồn tại (409) → trả error, KHÔNG signIn', async () => {
    stubFetch(() => jsonRes({ error: 'An account with this email already exists' }, 409))

    const result = await signUp('a@b.co', 'Abcdef12')

    expect(result.ok).toBe(false)
    expect(result.error).toContain('already exists')
    expect(signInMock).not.toHaveBeenCalled()
  })
})

describe('logout + clearLocalData', () => {
  it('xóa MỌI key ankiflow_* nhưng giữ key khác', () => {
    localStorage.setItem('ankiflow_session_form_language', '{}')
    localStorage.setItem('ankiflow_pending_result', 'x')
    localStorage.setItem('ankiflow_pending_batch', 'y')
    localStorage.setItem('other_app_key', 'keep')

    clearLocalData()

    expect(localStorage.getItem('ankiflow_session_form_language')).toBeNull()
    expect(localStorage.getItem('ankiflow_pending_result')).toBeNull()
    expect(localStorage.getItem('ankiflow_pending_batch')).toBeNull()
    expect(localStorage.getItem('other_app_key')).toBe('keep')
  })

  it('logout: DELETE session → signOut client → clear local data', async () => {
    localStorage.setItem('ankiflow_pending_result', 'x')
    const fetchMock = stubFetch(() => jsonRes({ success: true }))

    await logout()

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/auth/session')
    expect(init.method).toBe('DELETE')
    expect(signOutMock).toHaveBeenCalledOnce()
    expect(localStorage.getItem('ankiflow_pending_result')).toBeNull()
  })

  it('logout vẫn dọn local dù DELETE request fail', async () => {
    localStorage.setItem('ankiflow_pending_result', 'x')
    stubFetch(() => {
      throw new TypeError('network down')
    })

    await logout()

    expect(signOutMock).toHaveBeenCalledOnce()
    expect(localStorage.getItem('ankiflow_pending_result')).toBeNull()
  })
})
