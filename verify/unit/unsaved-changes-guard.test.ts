import { createElement, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UnsavedChangesProvider } from '@/components/providers/UnsavedChangesProvider'
import {
  useConfirmNavigation,
  useUnsavedChangesGuard,
} from '@/hooks/useUnsavedChangesGuard'

interface GuardHarnessProps {
  dirty: boolean
  onNavigate: () => void
}

function GuardHarness({ dirty, onNavigate }: GuardHarnessProps) {
  useUnsavedChangesGuard(dirty)
  const confirmNavigation = useConfirmNavigation()

  return createElement(
    'div',
    null,
    createElement('button', {
      id: 'request-navigation',
      onClick: () => confirmNavigation(onNavigate),
    }, 'Navigate'),
    createElement('a', { id: 'leave-link', href: '/dashboard' }, 'Leave page'),
  )
}

let container: HTMLDivElement
let root: Root

async function renderGuard(dirty: boolean, onNavigate = vi.fn()) {
  await act(async () => {
    root.render(createElement(
      UnsavedChangesProvider,
      null,
      createElement(GuardHarness, { dirty, onNavigate }),
    ))
  })
  return onNavigate
}

function modalHeading(): HTMLHeadingElement | null {
  return container.querySelector('h2')
}

beforeEach(() => {
  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  window.history.replaceState({}, '', '/settings')
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  window.history.replaceState({}, '', '/')
})

describe('UnsavedChangesProvider', () => {
  it('変更がない場合は確認せず navigation action を実行する', async () => {
    const onNavigate = await renderGuard(false)

    await act(async () => {
      container.querySelector<HTMLButtonElement>('#request-navigation')?.click()
    })

    expect(onNavigate).toHaveBeenCalledOnce()
    expect(modalHeading()).toBeNull()

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })

  it('変更がある場合は保持または破棄を選択できる', async () => {
    const onNavigate = await renderGuard(true)

    await act(async () => {
      container.querySelector<HTMLButtonElement>('#request-navigation')?.click()
    })
    expect(modalHeading()?.textContent).toBe('Unsaved changes')
    expect(onNavigate).not.toHaveBeenCalled()

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find(button => button.textContent === 'Keep editing')
        ?.click()
    })
    expect(modalHeading()).toBeNull()
    expect(onNavigate).not.toHaveBeenCalled()

    await act(async () => {
      container.querySelector<HTMLButtonElement>('#request-navigation')?.click()
    })
    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find(button => button.textContent === 'Discard changes')
        ?.click()
    })
    expect(onNavigate).toHaveBeenCalledOnce()
    expect(modalHeading()).toBeNull()
  })

  it('変更がある場合は beforeunload を阻止する', async () => {
    await renderGuard(true)

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('変更がある場合は同一タブのリンク遷移を阻止する', async () => {
    await renderGuard(true)
    const link = container.querySelector<HTMLAnchorElement>('#leave-link')
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
    })

    await act(async () => {
      link?.dispatchEvent(event)
    })

    expect(event.defaultPrevented).toBe(true)
    expect(modalHeading()?.textContent).toBe('Unsaved changes')
    expect(window.location.pathname).toBe('/settings')
  })

  it('変更がある場合は history navigation を元の URL に戻す', async () => {
    await renderGuard(true)
    window.history.pushState({ target: true }, '', '/dashboard')

    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate', { state: { target: true } }))
    })

    expect(window.location.pathname).toBe('/settings')
    expect(modalHeading()?.textContent).toBe('Unsaved changes')
  })
})
