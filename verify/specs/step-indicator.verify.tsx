import type { ComponentProps } from 'react'
import { z } from 'zod'
import { StepIndicator } from '@/components/ui/StepIndicator'
import { registerUnit } from '@/verify/core/registry'

type StepIndicatorProps = ComponentProps<typeof StepIndicator>

registerUnit<StepIndicatorProps>({
  id: 'StepIndicator',
  title: 'StepIndicator',
  description: 'Chỉ báo nhiều bước: completed (check) / active / pending (số).',
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
      description: '3 bước đều pending.',
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
      description: 'completed + active (có description) + pending.',
      props: {
        steps: [
          { label: 'Generate content', status: 'completed' },
          { label: 'Create audio', description: 'Đang gọi Google TTS…', status: 'active' },
          { label: 'Export to Anki', status: 'pending' },
        ],
      },
    },
    {
      id: 'all-completed',
      description: '2 bước đều completed.',
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
      description: 'Probe: mảng steps rỗng — render 0 hàng, không crash.',
      props: { steps: [] },
    },
    {
      id: 'probe-long-labels',
      probe: true,
      description: 'Probe: label 150 ký tự không phá render.',
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
      description: 'Số hàng render = steps.length',
      check: ({ root, props }) => {
        const el = root.querySelector('[data-verify-unit="StepIndicator"]')
        if (!el) return 'không tìm thấy root StepIndicator'
        const rows = el.children.length
        return rows === props.steps.length || `rows=${rows}, steps=${props.steps.length}`
      },
    },
    {
      id: 'check-icon-iff-completed',
      description: 'Số icon check (svg) = số bước completed',
      check: ({ root, props }) => {
        const svgs = root.querySelectorAll('svg').length
        const completed = props.steps.filter(s => s.status === 'completed').length
        return svgs === completed || `svg=${svgs}, completed=${completed}`
      },
    },
    {
      id: 'labels-rendered',
      description: 'Mọi label của step đều hiển thị',
      check: ({ root, props }) => {
        const text = root.textContent ?? ''
        const missing = props.steps.filter(s => !text.includes(s.label))
        return missing.length === 0 || `thiếu label: ${missing.map(s => s.label.slice(0, 20)).join(', ')}`
      },
    },
    {
      id: 'descriptions-iff-provided',
      description: 'Số đoạn text = số step + số description',
      check: ({ root, props }) => {
        const paragraphs = root.querySelectorAll('p').length
        const expected =
          props.steps.length + props.steps.filter(s => s.description).length
        return paragraphs === expected || `p=${paragraphs}, expected=${expected}`
      },
    },
    {
      id: 'contract-count-matches',
      description: 'data-verify-count khớp steps.length',
      check: ({ contract, props }) =>
        Number(contract.count) === props.steps.length ||
        `contract.count=${contract.count}, steps=${props.steps.length}`,
    },
  ],
})
