import { z } from 'zod'
import { NavigationSidebar } from '@/components/layout/NavigationSidebar'
import { UnsavedChangesProvider } from '@/components/providers/UnsavedChangesProvider'
import { verifyGlobals } from '@/verify/core/globals'
import { registerUnit } from '@/verify/core/registry'

const NAV_HREFS = ['/dashboard', '/create', '/history', '/admin', '/settings']
// Harness coi TEST_AUTH_USER là admin (test-setup) → mục adminOnly "App Settings" hiển thị.
const ADMIN_NAV_HREF = '/settings/admin'

// Mock fetch cho ConnectedBadge bên trong (ping AnkiConnect localhost:8765 trực tiếp khi mount)
const ankiConnectMock = {
  fetch: [
    { match: 'localhost:8765', response: { status: 200, json: { result: 6, error: null } } },
  ],
}

// Active styling theo pathname chỉ kiểm chứng được trong vitest (next/navigation
// được mock); trên browser usePathname trả path thật (/verify/...) → bỏ qua.
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
    'Sidebar điều hướng chính: logo, nav link (5 chung + App Settings admin-only), ConnectedBadge; responsive drawer.',
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
      description: 'pathname=/dashboard → mục Dashboard active (vitest-only).',
      props: {},
      mocks: { pathname: '/dashboard', ...ankiConnectMock },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'create-active',
      description: 'pathname=/create → mục Create Card active (vitest-only).',
      props: {},
      mocks: { pathname: '/create', ...ankiConnectMock },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'settings-active',
      description: 'pathname=/settings → mục Settings active (không kéo theo App Settings).',
      props: {},
      mocks: { pathname: '/settings', ...ankiConnectMock },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'settings-admin-active',
      description:
        'pathname=/settings/admin → CHỈ App Settings active (longest-prefix, /settings không sáng theo).',
      props: {},
      mocks: { pathname: '/settings/admin', ...ankiConnectMock },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'probe-unknown-path',
      probe: true,
      description: 'Probe: pathname lạ → không mục nào active, sidebar vẫn render đủ.',
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
      description: 'Đủ 5 nav link với href đúng',
      check: ({ root }) => {
        const hrefs = Array.from(root.querySelectorAll('aside nav a')).map(a =>
          a.getAttribute('href')
        )
        const missing = NAV_HREFS.filter(h => !hrefs.includes(h))
        return missing.length === 0 || `thiếu link: ${missing.join(', ')}`
      },
    },
    {
      id: 'admin-nav-link-present',
      description: 'Mục adminOnly "App Settings" (/settings/admin) hiện với admin',
      check: ({ root }) => {
        const hrefs = Array.from(root.querySelectorAll('aside nav a')).map(a =>
          a.getAttribute('href')
        )
        return hrefs.includes(ADMIN_NAV_HREF) || `thiếu link admin: ${ADMIN_NAV_HREF}`
      },
    },
    {
      id: 'logo-present',
      description: 'Logo AnkiFlow hiện diện',
      check: ({ root }) =>
        !!root.querySelector('[data-verify-unit="AnkiFlowLogo"]') || 'không có logo',
    },
    {
      id: 'connected-badge-present',
      description: 'ConnectedBadge hiện diện ở đáy sidebar',
      check: ({ root }) =>
        !!root.querySelector('[data-verify-unit="ConnectedBadge"]') ||
        'không có ConnectedBadge',
    },
    {
      id: 'active-matches-pathname',
      description: 'Mục active khớp pathname (chỉ kiểm trong vitest)',
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
