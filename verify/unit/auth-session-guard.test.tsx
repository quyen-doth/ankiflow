import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AuthContext, type AuthUser } from '@/components/providers/AuthProvider'
import { AuthSessionGuard } from '@/components/layout/AuthSessionGuard'
import { verifyGlobals } from '@/verify/core/globals'

/**
 * AuthSessionGuard — "split-brain" (cookie 有効 + client SDK signed-out) を検出したら
 * session cookie を破棄して /login へ強制遷移する。
 * usePathname は verify/test-setup.ts の global mock (__verifyNav.pathname) を使う。
 */

const TEST_USER: AuthUser = { uid: 'u1', email: 'user@test.dev' }

let container: HTMLDivElement
let root: Root

function renderGuard(options: {
  user: AuthUser | null
  loading: boolean
  clearSession: () => Promise<unknown>
  redirect: (path: string) => void
}) {
  act(() => {
    root.render(
      <AuthContext.Provider value={{ user: options.user, loading: options.loading }}>
        <AuthSessionGuard clearSession={options.clearSession} redirect={options.redirect} />
      </AuthContext.Provider>,
    )
  })
}

async function flushAsyncEffects() {
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  verifyGlobals().__verifyNav!.pathname = '/create'
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('AuthSessionGuard', () => {
  it('user null + loading 完了 → cookie 削除してから /login へ遷移', async () => {
    const calls: string[] = []
    const clearSession = vi.fn(async () => {
      calls.push('clear')
    })
    const redirect = vi.fn((path: string) => {
      calls.push(`redirect:${path}`)
    })

    renderGuard({ user: null, loading: false, clearSession, redirect })
    await flushAsyncEffects()

    expect(clearSession).toHaveBeenCalledTimes(1)
    expect(redirect).toHaveBeenCalledWith('/login')
    // 順序: 必ず cookie 破棄 → 遷移 (逆だと middleware が /login を跳ね返す)
    expect(calls).toEqual(['clear', 'redirect:/login'])
  })

  it('clearSession が失敗しても /login へ遷移する', async () => {
    const clearSession = vi.fn(async () => {
      throw new Error('network down')
    })
    const redirect = vi.fn()

    renderGuard({ user: null, loading: false, clearSession, redirect })
    await flushAsyncEffects()

    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('loading 中は何もしない', async () => {
    const clearSession = vi.fn(async () => {})
    const redirect = vi.fn()

    renderGuard({ user: null, loading: true, clearSession, redirect })
    await flushAsyncEffects()

    expect(clearSession).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it('user がいる場合は何もしない', async () => {
    const clearSession = vi.fn(async () => {})
    const redirect = vi.fn()

    renderGuard({ user: TEST_USER, loading: false, clearSession, redirect })
    await flushAsyncEffects()

    expect(clearSession).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it.each(['/login', '/signup', '/verify', '/verify/Unit/fixture'])(
    '除外 route %s では発火しない',
    async (pathname) => {
      verifyGlobals().__verifyNav!.pathname = pathname
      const clearSession = vi.fn(async () => {})
      const redirect = vi.fn()

      renderGuard({ user: null, loading: false, clearSession, redirect })
      await flushAsyncEffects()

      expect(clearSession).not.toHaveBeenCalled()
      expect(redirect).not.toHaveBeenCalled()
    },
  )

  it('一度発火したら再 render でも重複発火しない', async () => {
    const clearSession = vi.fn(async () => {})
    const redirect = vi.fn()

    renderGuard({ user: null, loading: false, clearSession, redirect })
    await flushAsyncEffects()
    renderGuard({ user: null, loading: false, clearSession, redirect })
    await flushAsyncEffects()

    expect(clearSession).toHaveBeenCalledTimes(1)
    expect(redirect).toHaveBeenCalledTimes(1)
  })
})
