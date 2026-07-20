import { z } from 'zod'
import { AppShell } from '@/components/layout/AppShell'
import { verifyGlobals } from '@/verify/core/globals'
import { registerUnit } from '@/verify/core/registry'
import { reactNode } from '@/verify/core/schema-helpers'

// 検証用コメント。
const ankiConnectMock = {
  fetch: [
    { match: 'localhost:8765', response: { status: 200, json: { result: 6, error: null } } },
  ],
}

// 検証用コメント。
const EXPECTED_AUTH: Record<string, boolean> = {
  'app-route-dashboard': false,
  'auth-route-login': true,
  'probe-auth-route-signup': true,
}

registerUnit<{ children?: React.ReactNode }>({
  id: 'AppShell',
  title: 'AppShell',
  description: '検証ケース。',
  kind: 'component',
  render: props => <AppShell>{props.children ?? <p>content</p>}</AppShell>,
  propsSchema: z.object({
    children: reactNode().optional(),
  }),
  fixtures: [
    {
      id: 'app-route-dashboard',
      description: '検証ケース。',
      props: {},
      mocks: { ...ankiConnectMock, pathname: '/dashboard' },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'auth-route-login',
      description: '検証ケース。',
      props: {},
      mocks: { ...ankiConnectMock, pathname: '/login' },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'probe-auth-route-signup',
      probe: true,
      description: '検証ケース。',
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
      description: '検証ケース。',
      check: ({ root, fixture }) => {
        if (!verifyGlobals().__verifyNav) return true
        const expected = EXPECTED_AUTH[fixture.id]
        if (expected === undefined) return true
        // 検証用コメント。
        // 検証用コメント。
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
      description: '検証ケース。',
      check: ({ root, fixture }) => {
        if (!verifyGlobals().__verifyNav) return true
        const expected = EXPECTED_AUTH[fixture.id]
        if (expected === undefined) return true
        const hasAside = !!root.querySelector('aside')
        if (expected) {
          return !hasAside || 'auth route なのに sidebar (aside) が render されています'
        }
        return hasAside || '不足しています'
      },
    },
    {
      id: 'children-always-rendered',
      description: '検証ケース。',
      check: ({ root }) => {
        return !!root.querySelector('main') || '表示が見つかりません'
      },
    },
  ],
})
