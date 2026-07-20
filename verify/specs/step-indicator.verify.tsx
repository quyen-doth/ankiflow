import type { ComponentProps } from 'react'
import { z } from 'zod'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { registerUnit } from '@/verify/core/registry'

type StepIndicatorProps = ComponentProps<typeof StepIndicator>

registerUnit<StepIndicatorProps>({
  id: 'StepIndicator',
  title: 'StepIndicator',
  description: '検証ケース。',
  kind: 'component',
  render: props => <StepIndicator {...props} />,
  propsSchema: z.object({
    steps: z.array(
      z.object({
        label: z.string(),
        description: z.string().optional(),
        status: z.enum(['completed', 'active', 'pending']),
      })
    ),
    className: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'all-pending',
      description: '検証ケース。',
      props: {
        steps: [
          { label: 'Generate content', status: 'pending' },
          { label: 'Create audio', status: 'pending' },
          { label: 'Export to Anki', status: 'pending' },
        ],
      },
    },
    {
      id: 'mixed',
      description: '検証ケース。',
      props: {
        steps: [
          { label: 'Generate content', status: 'completed' },
          { label: 'Create audio', description: '検証ケース。', status: 'active' },
          { label: 'Export to Anki', status: 'pending' },
        ],
      },
    },
    {
      id: 'all-completed',
      description: '検証ケース。',
      props: {
        steps: [
          { label: 'Generate content', status: 'completed' },
          { label: 'Create audio', status: 'completed' },
        ],
      },
    },
    {
      id: 'probe-empty-steps',
      probe: true,
      description: '検証ケース。',
      props: { steps: [] },
    },
    {
      id: 'probe-long-labels',
      probe: true,
      description: '検証ケース。',
      props: {
        steps: [
          { label: 'a'.repeat(150), status: 'active' },
          { label: 'b'.repeat(150), description: 'c'.repeat(150), status: 'pending' },
        ],
      },
    },
  ],
  invariants: [
    {
      id: 'row-count-matches',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const el = root.querySelector('[data-verify-unit="StepIndicator"]')
        if (!el) return '要素が見つかりません'
        const rows = el.children.length
        return rows === props.steps.length || `rows=${rows}, steps=${props.steps.length}`
      },
    },
    {
      id: 'check-icon-iff-completed',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const svgs = root.querySelectorAll('svg').length
        const completed = props.steps.filter(s => s.status === 'completed').length
        return svgs === completed || `svg=${svgs}, completed=${completed}`
      },
    },
    {
      id: 'labels-rendered',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const text = root.textContent ?? ''
        const missing = props.steps.filter(s => !text.includes(s.label))
        return missing.length === 0 || `label 不足: ${missing.map(s => s.label.slice(0, 20)).join(', ')}`
      },
    },
    {
      id: 'descriptions-iff-provided',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const paragraphs = root.querySelectorAll('p').length
        const expected =
          props.steps.length + props.steps.filter(s => s.description).length
        return paragraphs === expected || `p=${paragraphs}, expected=${expected}`
      },
    },
    {
      id: 'contract-count-matches',
      description: 'data-verify-count が steps.length と一致',
      check: ({ contract, props }) =>
        Number(contract.count) === props.steps.length ||
        `contract.count=${contract.count}, steps=${props.steps.length}`,
    },
  ],
})
