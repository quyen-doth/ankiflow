import type { ComponentProps } from 'react'
import { z } from 'zod'
import { FlowTip } from '@/components/ui/FlowTip'
import { registerUnit } from '@/verify/core/registry'
import { reactNode } from '@/verify/core/schema-helpers'

type FlowTipProps = ComponentProps<typeof FlowTip>

registerUnit<FlowTipProps>({
  id: 'FlowTip',
  title: 'FlowTip',
  description: '検証ケース。',
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
      description: 'default label は "Flow Tip"。',
      props: { children: 'Review cards within 24 hours for best retention.' },
    },
    {
      id: 'custom-label',
      description: '検証ケース。',
      props: { label: 'Pro Tip', children: 'Use collocations to learn faster.' },
    },
    {
      id: 'probe-empty-children',
      probe: true,
      description: '検証ケース。',
      props: { children: '' },
    },
  ],
  invariants: [
    {
      id: 'label-matches-contract',
      description: 'data-verify-label が props.label と一致 (default は "Flow Tip")',
      check: ({ contract, props }) => {
        const expected = props.label ?? 'Flow Tip'
        return contract.label === expected || `contract.label="${contract.label}", expected="${expected}"`
      },
    },
    {
      id: 'label-visible',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const expected = props.label ?? 'Flow Tip'
        return (root.textContent ?? '').includes(expected) || `label が見つかりません "${expected}"`
      },
    },
    {
      id: 'icon-present',
      description: '検証ケース。',
      check: ({ root }) => !!root.querySelector('svg') || '対象がありません',
    },
  ],
})
