import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock firebase/auth — capture callback của onAuthStateChanged để chủ động bắn auth state
const { authState } = vi.hoisted(() => ({
  authState: {
    callback: null as ((user: unknown) => void) | null,
    unsubscribed: false,
  },
}))
vi.mock('firebase/auth', () => ({
  getAuth: () => ({}),
  onAuthStateChanged: (_auth: unknown, cb: (user: unknown) => void) => {
    authState.callback = cb
    return () => {
      authState.unsubscribed = true
    }
  },
}))

// File .test.ts (vitest include không nhận .tsx) → dùng createElement thay JSX
import { createElement, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { AuthProvider, useAuth } from '@/components/providers/AuthProvider'

function Probe() {
  const { user, loading } = useAuth()
  return createElement('div', {
    id: 'probe',
    'data-loading': String(loading),
    'data-uid': user?.uid ?? '',
    'data-email': user?.email ?? '',
  })
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  authState.callback = null
  authState.unsubscribed = false
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const probe = () => {
  const el = container.querySelector('#probe')
  if (!el) throw new Error('probe not mounted')
  return {
    loading: el.getAttribute('data-loading'),
    uid: el.getAttribute('data-uid'),
    email: el.getAttribute('data-email'),
  }
}

describe('AuthProvider', () => {
  it('loading=true cho đến khi Firebase trả auth state đầu tiên', () => {
    act(() => {
      root.render(createElement(AuthProvider, null, createElement(Probe)))
    })

    expect(probe().loading).toBe('true')
    expect(authState.callback).not.toBeNull()
  })

  it('đăng nhập → user {uid, email}, loading=false', () => {
    act(() => {
      root.render(createElement(AuthProvider, null, createElement(Probe)))
    })
    act(() => {
      authState.callback?.({ uid: 'u1', email: 'a@b.co' })
    })

    expect(probe()).toEqual({ loading: 'false', uid: 'u1', email: 'a@b.co' })
  })

  it('logout (callback null) → user=null, loading vẫn false', () => {
    act(() => {
      root.render(createElement(AuthProvider, null, createElement(Probe)))
    })
    act(() => {
      authState.callback?.({ uid: 'u1', email: 'a@b.co' })
    })
    act(() => {
      authState.callback?.(null)
    })

    expect(probe()).toEqual({ loading: 'false', uid: '', email: '' })
  })

  it('unmount → unsubscribe listener (tránh leak)', () => {
    act(() => {
      root.render(createElement(AuthProvider, null, createElement(Probe)))
    })
    act(() => root.unmount())

    expect(authState.unsubscribed).toBe(true)
  })
})
