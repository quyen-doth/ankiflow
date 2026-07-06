import { z } from 'zod'
import { AppShell } from '@/components/layout/AppShell'
import { verifyGlobals } from '@/verify/core/globals'
import { registerUnit } from '@/verify/core/registry'
import { reactNode } from '@/verify/core/schema-helpers'

// Mock fetch cho ConnectedBadge bên trong sidebar (ping AnkiConnect localhost:8765 khi mount)
const ankiConnectMock = {
  fetch: [
    { match: 'localhost:8765', response: { status: 200, json: { result: 6, error: null } } },
  ],
}

// authRoute kỳ vọng theo fixture (pathname mock chỉ hoạt động trong vitest)
const EXPECTED_AUTH: Record<string, boolean> = {
  'app-route-dashboard': false,
  'auth-route-login': true,
  'probe-auth-route-signup': true,
}

registerUnit<{ children?: React.ReactNode }>({
  id: 'AppShell',
  title: 'AppShell',
  description: 'Shell của app: sidebar + main offset; tự ẩn cả hai trên route auth (/login, /signup).',
  kind: 'component',
  render: props => <AppShell>{props.children ?? <p>content</p>}</AppShell>,
  propsSchema: z.object({
    children: reactNode().optional(),
  }),
  fixtures: [
    {
      id: 'app-route-dashboard',
      description: 'Route thường (/dashboard): có sidebar + main offset.',
      props: {},
      mocks: { ...ankiConnectMock, pathname: '/dashboard' },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'auth-route-login',
      description: 'Route auth (/login): KHÔNG sidebar, main không offset.',
      props: {},
      mocks: { ...ankiConnectMock, pathname: '/login' },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'probe-auth-route-signup',
      probe: true,
      description: 'Probe: /signup cũng là auth route — sidebar tuyệt đối không xuất hiện.',
      props: {},
      mocks: { ...ankiConnectMock, pathname: '/signup' },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
  ],
  invariants: [
    {
      id: 'auth-route-flag-correct',
      description: 'data-verify-authroute khớp pathname (vitest-only — browser dùng App Router thật)',
      check: ({ root, fixture }) => {
        if (!verifyGlobals().__verifyNav) return true
        const expected = EXPECTED_AUTH[fixture.id]
        if (expected === undefined) return true
        // Sidebar (unit NavigationSidebar) mount trước <main> → phải query đúng element
        // của AppShell thay vì đọc contract mặc định (element contract đầu tiên).
        const el = root.querySelector('[data-verify-unit="AppShell"]')
        const actual = el?.getAttribute('data-verify-authroute')
        return (
          actual === String(expected) ||
          `data-verify-authroute="${actual}", expected=${expected}`
        )
      },
    },
    {
      id: 'sidebar-visibility-matches-route',
      description: 'Sidebar (aside) chỉ render trên route thường, không render trên route auth',
      check: ({ root, fixture }) => {
        if (!verifyGlobals().__verifyNav) return true
        const expected = EXPECTED_AUTH[fixture.id]
        if (expected === undefined) return true
        const hasAside = !!root.querySelector('aside')
        if (expected) {
          return !hasAside || 'route auth nhưng vẫn render sidebar (aside)'
        }
        return hasAside || 'route thường nhưng thiếu sidebar (aside)'
      },
    },
    {
      id: 'children-always-rendered',
      description: 'Children luôn được render trong main bất kể route',
      check: ({ root }) => {
        return !!root.querySelector('main') || 'không thấy <main>'
      },
    },
  ],
})
