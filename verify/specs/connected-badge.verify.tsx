import type { ComponentProps } from 'react'
import { z } from 'zod'
import { ConnectedBadge } from '@/components/ui/ConnectedBadge'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type ConnectedBadgeProps = ComponentProps<typeof ConnectedBadge>

// 検証用コメント。
const EXPECTED_CONNECTED: Record<string, boolean> = {
  'prop-connected': true,
  'prop-disconnected': false,
  'connected-zero-sync': true,
  'polled-ok': true,
  'polled-down': false,
  'probe-fetch-throws': false,
}

registerUnit<ConnectedBadgeProps>({
  id: 'ConnectedBadge',
  title: 'ConnectedBadge',
  description: '検証ケース。',
  kind: 'component',
  render: props => <ConnectedBadge {...props} />,
  propsSchema: z.object({
    connected: z.boolean().optional(),
    unsyncedCount: z.number().optional(),
    onSync: fn<() => void>().optional(),
  }),
  fixtures: [
    {
      id: 'prop-connected',
      description: '検証ケース。',
      props: { connected: true },
    },
    {
      id: 'prop-disconnected',
      description: '検証ケース。',
      props: { connected: false },
    },
    {
      id: 'connected-zero-sync',
      description: '検証ケース。',
      props: { connected: true, unsyncedCount: 0, onSync: () => undefined },
    },
    {
      id: 'polled-ok',
      description: '検証ケース。',
      props: {},
      mocks: {
        fetch: [
          { match: 'localhost:8765', response: { status: 200, json: { result: 6, error: null } } },
        ],
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'polled-down',
      description: '検証ケース。',
      props: {},
      mocks: {
        fetch: [
          {
            match: 'localhost:8765',
            response: { status: 200, json: { result: null, error: 'collection is not available' } },
          },
        ],
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
    {
      id: 'probe-fetch-throws',
      probe: true,
      description: '検証ケース。',
      props: {},
      mocks: {
        fetch: [{ match: 'localhost:8765', response: { reject: true } }],
      },
      act: async ctx => {
        await ctx.wait(50)
      },
    },
  ],
  invariants: [
    {
      id: 'connected-state-correct',
      description: '検証ケース。',
      check: ({ contract, fixture }) => {
        const expected = EXPECTED_CONNECTED[fixture.id]
        if (expected === undefined) return true
        return (
          contract.connected === String(expected) ||
          `contract.connected="${contract.connected}", expected=${expected}`
        )
      },
    },
    {
      id: 'status-text-matches-state',
      description: '検証ケース。',
      check: ({ root, contract }) => {
        const text = root.textContent ?? ''
        const expected = contract.connected === 'true' ? 'Anki connected' : 'Anki offline'
        return text.includes(expected) || `見つかりません "${expected}" trong "${text.trim()}"`
      },
    },
    {
      id: 'sync-remains-available-with-zero-cards',
      description: '検証ケース。',
      onlyFixtures: ['connected-zero-sync'],
      check: ({ root }) => {
        const button = Array.from(root.querySelectorAll('button'))
          .find(element => element.textContent?.trim() === 'Sync')
        return !!button || '表示が見つかりません'
      },
    },
  ],
})
