import type { ComponentProps } from 'react'
import { z } from 'zod'
import { StatCard } from '@/components/ui/StatCard'
import { registerUnit } from '@/verify/core/registry'
import { reactNode } from '@/verify/core/schema-helpers'

type StatCardProps = ComponentProps<typeof StatCard>

registerUnit<StatCardProps>({
  id: 'StatCard',
  title: 'StatCard',
  description: '検証ケース。',
  kind: 'component',
  render: props => <StatCard {...props} />,
  propsSchema: z.object({
    label: z.string(),
    value: z.union([z.string(), z.number()]),
    delta: z.string().optional(),
    icon: reactNode().optional(),
    className: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'basic',
      description: 'Label と数値 value。',
      props: { label: 'Total Cards', value: 128 },
    },
    {
      id: 'with-delta-icon',
      description: '検証ケース。',
      props: {
        label: 'This Week',
        value: '23',
        delta: '+12% vs last week',
        icon: <span data-icon="stat">📈</span>,
      },
    },
    {
      id: 'probe-zero-value',
      probe: true,
      description: 'Probe: value = 0 でも "0" を表示する (falsy として扱わない)。',
      props: { label: 'Exported', value: 0 },
    },
  ],
  invariants: [
    {
      id: 'label-visible',
      description: '検証ケース。',
      check: ({ root, props }) =>
        (root.textContent ?? '').includes(props.label) || `label が見つかりません "${props.label}"`,
    },
    {
      id: 'value-visible',
      description: '検証ケース。',
      check: ({ root, props }) =>
        (root.textContent ?? '').includes(String(props.value)) ||
        `value が見つかりません "${props.value}"`,
    },
    {
      id: 'delta-iff-provided',
      description: '検証ケース。',
      check: ({ root, props }) => {
        if (!props.delta) return true
        return (root.textContent ?? '').includes(props.delta) || '表示が見つかりません'
      },
    },
  ],
})
