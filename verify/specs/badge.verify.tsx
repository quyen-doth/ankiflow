import type { ComponentProps } from 'react'
import { z } from 'zod'
import { Badge } from '@/components/ui/Badge'
import { registerUnit } from '@/verify/core/registry'
import { fn, reactNode } from '@/verify/core/schema-helpers'

type BadgeProps = ComponentProps<typeof Badge>

// 検証用コメント。
const removeSpy = { count: 0 }

registerUnit<BadgeProps>({
  id: 'Badge',
  title: 'Badge',
  description: '検証ケース。',
  kind: 'component',
  render: props => <Badge {...props} />,
  propsSchema: z.object({
    variant: z
      .enum(['neutral', 'active', 'inactive', 'pending', 'ai', 'language', 'level'])
      .optional(),
    children: reactNode(),
    className: z.string().optional(),
    onRemove: fn().optional(),
  }),
  fixtures: [
    {
      id: 'neutral-default',
      description: '検証ケース。',
      props: { children: 'Draft' },
    },
    {
      id: 'active',
      description: 'Variant active.',
      props: { variant: 'active', children: 'Active' },
    },
    {
      id: 'ai',
      description: 'Variant ai.',
      props: { variant: 'ai', children: 'AI Generated' },
    },
    {
      id: 'with-remove',
      description: '検証ケース。',
      props: {
        children: 'Tag',
        onRemove: () => {
          removeSpy.count++
        },
      },
      act: async ctx => {
        removeSpy.count = 0
        await ctx.click('button[aria-label="Remove"]')
      },
    },
    {
      id: 'probe-empty-label',
      probe: true,
      description: '検証ケース。',
      props: { children: '' },
    },
    {
      id: 'probe-long-label',
      probe: true,
      description: '検証ケース。',
      props: { children: 'x'.repeat(200) },
    },
  ],
  invariants: [
    {
      id: 'has-visible-label',
      description: '検証ケース。',
      check: ({ root }) => {
        const el = root.querySelector('[data-verify-unit="Badge"]')
        if (!el) return '要素が見つかりません'
        const label = (el.textContent ?? '').replace(/×/g, '').trim()
        return label.length > 0 || '対象がありません'
      },
    },
    {
      id: 'remove-button-iff-onRemove',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const btn = root.querySelector('button[aria-label="Remove"]')
        const expected = typeof props.onRemove === 'function'
        return !!btn === expected || `expected remove-button=${expected}, got ${!!btn}`
      },
    },
    {
      id: 'variant-matches-contract',
      description: '検証ケース。',
      check: ({ contract, props }) =>
        contract.variant === (props.variant ?? 'neutral') ||
        `contract.variant="${contract.variant}", props.variant="${props.variant ?? 'neutral'}"`,
    },
    {
      id: 'remove-fires-once',
      description: '検証ケース。',
      onlyFixtures: ['with-remove'],
      check: () => removeSpy.count === 1 || `呼び出し回数が不正です`,
    },
  ],
})
