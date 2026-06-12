import type { ComponentProps } from 'react'
import { z } from 'zod'
import { StatCard } from '@/components/ui/StatCard'
import { registerUnit } from '@/verify/core/registry'
import { reactNode } from '@/verify/core/schema-helpers'

type StatCardProps = ComponentProps<typeof StatCard>

registerUnit<StatCardProps>({
  id: 'StatCard',
  title: 'StatCard',
  description: 'Thẻ thống kê dashboard: label, value, delta, icon.',
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
      description: 'Label + value số.',
      props: { label: 'Total Cards', value: 128 },
    },
    {
      id: 'with-delta-icon',
      description: 'Đầy đủ delta + icon.',
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
      description: 'Probe: value = 0 vẫn hiển thị "0" (không bị coi là falsy).',
      props: { label: 'Exported', value: 0 },
    },
  ],
  invariants: [
    {
      id: 'label-visible',
      description: 'Label hiển thị',
      check: ({ root, props }) =>
        (root.textContent ?? '').includes(props.label) || `không thấy label "${props.label}"`,
    },
    {
      id: 'value-visible',
      description: 'Value hiển thị (kể cả 0)',
      check: ({ root, props }) =>
        (root.textContent ?? '').includes(String(props.value)) ||
        `không thấy value "${props.value}"`,
    },
    {
      id: 'delta-iff-provided',
      description: 'Delta hiển thị khi và chỉ khi có props.delta',
      check: ({ root, props }) => {
        if (!props.delta) return true
        return (root.textContent ?? '').includes(props.delta) || 'không thấy delta'
      },
    },
  ],
})
