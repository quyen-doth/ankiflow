import type { ComponentProps } from 'react'
import { z } from 'zod'
import { Badge } from '@/components/ui/Badge'
import { registerUnit } from '@/verify/core/registry'
import { fn, reactNode } from '@/verify/core/schema-helpers'

type BadgeProps = ComponentProps<typeof Badge>

// Spy đếm số lần onRemove được gọi — act reset trước khi click
const removeSpy = { count: 0 }

registerUnit<BadgeProps>({
  id: 'Badge',
  title: 'Badge',
  description: 'Chip/badge với variant và nút remove tùy chọn.',
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
      description: 'Badge mặc định (variant neutral).',
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
      description: 'Có nút remove; act: click → onRemove gọi đúng 1 lần.',
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
      description: 'Probe (EXPECTED_FAIL): children rỗng — badge không có nhãn nhìn thấy.',
      props: { children: '' },
    },
    {
      id: 'probe-long-label',
      probe: true,
      description: 'Probe: nhãn 200 ký tự vẫn render bình thường.',
      props: { children: 'x'.repeat(200) },
    },
  ],
  invariants: [
    {
      id: 'has-visible-label',
      description: 'Badge phải có nhãn nhìn thấy (text không rỗng, không tính nút ×)',
      check: ({ root }) => {
        const el = root.querySelector('[data-verify-unit="Badge"]')
        if (!el) return 'không tìm thấy root Badge'
        const label = (el.textContent ?? '').replace(/×/g, '').trim()
        return label.length > 0 || 'badge không có nhãn nhìn thấy'
      },
    },
    {
      id: 'remove-button-iff-onRemove',
      description: 'Nút remove hiện diện khi và chỉ khi có onRemove',
      check: ({ root, props }) => {
        const btn = root.querySelector('button[aria-label="Remove"]')
        const expected = typeof props.onRemove === 'function'
        return !!btn === expected || `expected remove-button=${expected}, got ${!!btn}`
      },
    },
    {
      id: 'variant-matches-contract',
      description: 'data-verify-variant khớp props.variant (mặc định neutral)',
      check: ({ contract, props }) =>
        contract.variant === (props.variant ?? 'neutral') ||
        `contract.variant="${contract.variant}", props.variant="${props.variant ?? 'neutral'}"`,
    },
    {
      id: 'remove-fires-once',
      description: 'Click remove gọi onRemove đúng 1 lần',
      onlyFixtures: ['with-remove'],
      check: () => removeSpy.count === 1 || `onRemove được gọi ${removeSpy.count} lần`,
    },
  ],
})
