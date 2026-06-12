import type { ComponentProps } from 'react'
import { z } from 'zod'
import { FlowTip } from '@/components/ui/FlowTip'
import { registerUnit } from '@/verify/core/registry'
import { reactNode } from '@/verify/core/schema-helpers'

type FlowTipProps = ComponentProps<typeof FlowTip>

registerUnit<FlowTipProps>({
  id: 'FlowTip',
  title: 'FlowTip',
  description: 'Callout gợi ý AI: icon bóng đèn + nhãn + nội dung.',
  kind: 'component',
  render: props => <FlowTip {...props} />,
  propsSchema: z.object({
    children: reactNode(),
    label: z.string().optional(),
    className: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'default-label',
      description: 'Nhãn mặc định "Flow Tip".',
      props: { children: 'Review cards within 24 hours for best retention.' },
    },
    {
      id: 'custom-label',
      description: 'Nhãn tùy chỉnh.',
      props: { label: 'Pro Tip', children: 'Use collocations to learn faster.' },
    },
    {
      id: 'probe-empty-children',
      probe: true,
      description: 'Probe: children rỗng — vẫn render khung + nhãn, không crash.',
      props: { children: '' },
    },
  ],
  invariants: [
    {
      id: 'label-matches-contract',
      description: 'data-verify-label khớp props.label (mặc định "Flow Tip")',
      check: ({ contract, props }) => {
        const expected = props.label ?? 'Flow Tip'
        return contract.label === expected || `contract.label="${contract.label}", expected="${expected}"`
      },
    },
    {
      id: 'label-visible',
      description: 'Nhãn hiển thị trong DOM',
      check: ({ root, props }) => {
        const expected = props.label ?? 'Flow Tip'
        return (root.textContent ?? '').includes(expected) || `không thấy nhãn "${expected}"`
      },
    },
    {
      id: 'icon-present',
      description: 'Có icon svg',
      check: ({ root }) => !!root.querySelector('svg') || 'không có svg',
    },
  ],
})
