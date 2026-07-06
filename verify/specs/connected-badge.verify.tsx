import type { ComponentProps } from 'react'
import { z } from 'zod'
import { ConnectedBadge } from '@/components/ui/ConnectedBadge'
import { registerUnit } from '@/verify/core/registry'

type ConnectedBadgeProps = ComponentProps<typeof ConnectedBadge>

// Trạng thái connected kỳ vọng cho từng fixture
const EXPECTED_CONNECTED: Record<string, boolean> = {
  'prop-connected': true,
  'prop-disconnected': false,
  'polled-ok': true,
  'polled-down': false,
  'probe-fetch-throws': false,
}

registerUnit<ConnectedBadgeProps>({
  id: 'ConnectedBadge',
  title: 'ConnectedBadge',
  description: 'Chỉ báo kết nối Anki: nhận prop hoặc tự ping AnkiConnect (localhost:8765) từ browser.',
  kind: 'component',
  render: props => <ConnectedBadge {...props} />,
  propsSchema: z.object({
    connected: z.boolean().optional(),
  }),
  fixtures: [
    {
      id: 'prop-connected',
      description: 'Trạng thái connected truyền qua prop (không poll).',
      props: { connected: true },
    },
    {
      id: 'prop-disconnected',
      description: 'Trạng thái offline truyền qua prop.',
      props: { connected: false },
    },
    {
      id: 'polled-ok',
      description: 'Tự ping, mock AnkiConnect trả version 6 → Connected.',
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
      description: 'Tự ping, mock AnkiConnect trả error → Anki offline.',
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
      description: 'Probe: fetch ném lỗi mạng (Anki đóng) → vẫn hiển thị Anki offline, không crash.',
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
      description: 'data-verify-connected khớp trạng thái kỳ vọng của fixture',
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
      description: 'Text trạng thái khớp connected (Anki connected / Anki offline)',
      check: ({ root, contract }) => {
        const text = root.textContent ?? ''
        const expected = contract.connected === 'true' ? 'Anki connected' : 'Anki offline'
        return text.includes(expected) || `không thấy "${expected}" trong "${text.trim()}"`
      },
    },
  ],
})
