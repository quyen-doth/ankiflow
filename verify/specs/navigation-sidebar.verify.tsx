import { z } from 'zod'
import { NavigationSidebar } from '@/components/layout/NavigationSidebar'
import { UnsavedChangesProvider } from '@/components/providers/UnsavedChangesProvider'
import { verifyGlobals } from '@/verify/core/globals'
import { registerUnit } from '@/verify/core/registry'

const NAV_HREFS = ['/dashboard', '/create', '/history', '/admin', '/settings']
// 検証用コメント。
const ADMIN_NAV_HREF = '/settings/admin'

// 検証用コメント。
const ankiConnectMock = {
  fetch: [
    { match: 'localhost:8765', response: { status: 200, json: { result: 6, error: null } } },
  ],
}

// 検証用コメント。
// 検証用コメント。
function checkActiveLink(root: HTMLElement, expectedHref: string | null): true | string {
  if (!verifyGlobals().__verifyNav) return true
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('aside nav a'))
  const active = links.filter(a => a.className.includes('bg-[rgba(49,99,66,0.1)]'))
  if (expectedHref === null) {
    return active.length === 0 || `${active.length} link active, expected 0`
  }
  if (active.length !== 1) return `${active.length} link active, expected 1`
  return (
    active[0].getAttribute('href') === expectedHref ||
    `active="${active[0].getAttribute('href')}", expected="${expectedHref}"`
  )
}

registerUnit<Record<string, never>>({
  id: 'NavigationSidebar',
  title: 'NavigationSidebar',
  description:
    'main navigation sidebar: logo、nav link (共通 5 件 + admin-only App Settings)、ConnectedBadge、responsive drawer。',
  kind: 'component',
  render: () => (
    <UnsavedChangesProvider>
      <NavigationSidebar />
    </UnsavedChangesProvider>
  ),
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'dashboard-active',
      description: '検証ケース。',
      props: {},
      mocks: { pathname: '/dashboard', ...ankiConnectMock },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'create-active',
      description: '検証ケース。',
      props: {},
      mocks: { pathname: '/create', ...ankiConnectMock },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'settings-active',
      description: '検証ケース。',
      props: {},
      mocks: { pathname: '/settings', ...ankiConnectMock },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'settings-admin-active',
      description:
        'pathname=/settings/admin → App Settings だけ active (longest-prefix、/settings は同時に active にならない)。',
      props: {},
      mocks: { pathname: '/settings/admin', ...ankiConnectMock },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'probe-unknown-path',
      probe: true,
      description: '検証ケース。',
      props: {},
      mocks: { pathname: '/nonexistent', ...ankiConnectMock },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
  ],
  invariants: [
    {
      id: 'all-nav-links-present',
      description: '検証ケース。',
      check: ({ root }) => {
        const hrefs = Array.from(root.querySelectorAll('aside nav a')).map(a =>
          a.getAttribute('href')
        )
        const missing = NAV_HREFS.filter(h => !hrefs.includes(h))
        return missing.length === 0 || `link 不足: ${missing.join(', ')}`
      },
    },
    {
      id: 'admin-nav-link-present',
      description: 'admin では adminOnly item "App Settings" (/settings/admin) を表示する',
      check: ({ root }) => {
        const hrefs = Array.from(root.querySelectorAll('aside nav a')).map(a =>
          a.getAttribute('href')
        )
        return hrefs.includes(ADMIN_NAV_HREF) || `不足しています`
      },
    },
    {
      id: 'logo-present',
      description: 'Logo AnkiFlow hiện diện',
      check: ({ root }) =>
        !!root.querySelector('[data-verify-unit="AnkiFlowLogo"]') || '対象がありません',
    },
    {
      id: 'connected-badge-present',
      description: '検証ケース。',
      check: ({ root }) =>
        !!root.querySelector('[data-verify-unit="ConnectedBadge"]') ||
        '対象がありません',
    },
    {
      id: 'active-matches-pathname',
      description: '検証ケース。',
      check: ({ root, fixture }) => {
        const expectedByFixture: Record<string, string | null> = {
          'dashboard-active': '/dashboard',
          'create-active': '/create',
          'settings-active': '/settings',
          'settings-admin-active': '/settings/admin',
          'probe-unknown-path': null,
        }
        const expected = expectedByFixture[fixture.id]
        if (expected === undefined) return true
        return checkActiveLink(root, expected)
      },
    },
  ],
})
