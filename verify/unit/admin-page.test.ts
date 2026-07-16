import { createElement, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { searchParamsState, authState, contentTypeScopes } = vi.hoisted(() => ({
  searchParamsState: { value: '' },
  authState: { user: null as { uid: string; email: string } | null },
  contentTypeScopes: [] as string[],
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchParamsState.value),
}))

vi.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({ user: authState.user, loading: false }),
}))

vi.mock('@/components/admin/CategoryManager', () => ({
  CategoryManager: () => 'Category manager',
}))
vi.mock('@/components/admin/CardTypeManager', () => ({
  CardTypeManager: () => 'Card type manager',
}))
vi.mock('@/components/admin/TopicManager', () => ({
  TopicManager: () => 'Topic manager',
}))
vi.mock('@/components/admin/DeckManager', () => ({
  DeckManager: () => 'Deck manager',
}))
vi.mock('@/components/admin/ContentTypeManager', () => ({
  ContentTypeManager: ({ scope }: { scope?: string }) => {
    contentTypeScopes.push(scope ?? 'workspace')
    return 'Content type manager'
  },
}))

import AdminPage from '@/app/admin/page'

const EXPECTED_TABS = [
  'Categories',
  'Card Types',
  'Topics',
  'Decks',
  'Content Types',
]

let container: HTMLDivElement
let root: Root

async function renderPage() {
  await act(async () => {
    root.render(createElement(AdminPage))
  })
}

function tabLabels(): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'))
    .map(tab => tab.textContent ?? '')
}

beforeEach(() => {
  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  searchParamsState.value = ''
  authState.user = null
  contentTypeScopes.length = 0
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('AdminPage', () => {
  it('管理対象の 5 tab のみを表示する', async () => {
    await renderPage()

    expect(tabLabels()).toEqual(EXPECTED_TABS)
    expect(container.textContent).not.toContain('Notifications')
  })

  it('旧 notifications deep link は Categories に fallback する', async () => {
    searchParamsState.value = 'tab=notifications'
    await renderPage()

    const selectedTab = container.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
    expect(selectedTab?.textContent).toBe('Categories')
    expect(container.textContent).toContain('Category manager')
  })

  it('有効な deep link は引き続き対象 tab を開く', async () => {
    searchParamsState.value = 'tab=content-types'
    await renderPage()

    const selectedTab = container.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
    expect(selectedTab?.textContent).toBe('Content Types')
    expect(container.textContent).toContain('Content type manager')
    expect(contentTypeScopes.at(-1)).toBe('workspace')
  })

  it('一般 user は Content Types を workspace scope だけで管理する', async () => {
    authState.user = { uid: 'user-a', email: 'user@example.com' }
    searchParamsState.value = 'tab=content-types'

    await renderPage()

    expect(container.querySelector('[role="radiogroup"][aria-label="Editing scope"]')).toBeNull()
    expect(contentTypeScopes.at(-1)).toBe('workspace')
  })

  it('admin が Content Types の New-user defaults に切り替えると global scope を渡す', async () => {
    authState.user = { uid: 'admin-a', email: process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '' }
    searchParamsState.value = 'tab=content-types'
    await renderPage()

    const globalScopeButton = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
      .find(button => button.textContent === 'New-user defaults')
    expect(globalScopeButton).toBeDefined()

    await act(async () => globalScopeButton?.click())

    expect(contentTypeScopes.at(-1)).toBe('global-defaults')
    expect(container.textContent).toContain('Editing the defaults new accounts receive on sign-up.')
  })
})
