import type { ComponentProps } from 'react'
import { z } from 'zod'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { registerUnit } from '@/verify/core/registry'

type LoadingOverlayProps = ComponentProps<typeof LoadingOverlay>

const midSteps: LoadingOverlayProps['steps'] = [
  { label: 'Generate content', status: 'completed' },
  { label: 'Create audio', description: 'Calling Google TTS…', status: 'active' },
  { label: 'Export to Anki', status: 'pending' },
]

registerUnit<LoadingOverlayProps>({
  id: 'LoadingOverlay',
  title: 'LoadingOverlay',
  description: '検証ケース。',
  kind: 'component',
  allowsEmptyRender: true,
  render: props => <LoadingOverlay {...props} />,
  propsSchema: z.object({
    open: z.boolean(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    steps: z.array(
      z.object({
        label: z.string(),
        description: z.string().optional(),
        status: z.enum(['completed', 'active', 'pending']),
      })
    ),
    progress: z.number(),
    flowTip: z.string().optional(),
    statusText: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'closed',
      description: '検証ケース。',
      props: { open: false, steps: midSteps, progress: 50 },
    },
    {
      id: 'mid-progress',
      description: '検証ケース。',
      props: {
        open: true,
        steps: midSteps,
        progress: 45,
        flowTip: '最初の 24 時間に review した card は記憶に残りやすい。',
        statusText: 'Generating audio…',
      },
    },
    {
      id: 'complete',
      description: '検証ケース。',
      props: {
        open: true,
        steps: midSteps.map(s => ({ ...s, status: 'completed' as const })),
        progress: 100,
      },
    },
    {
      id: 'probe-progress-overflow',
      probe: true,
      description: '検証ケース。',
      props: { open: true, steps: midSteps, progress: 160 },
    },
  ],
  invariants: [
    {
      id: 'renders-iff-open',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const el = root.querySelector('[data-verify-unit="LoadingOverlay"]')
        return !!el === props.open || `rendered=${!!el}, open=${props.open}`
      },
    },
    {
      id: 'progressbar-clamped',
      description: '検証ケース。',
      check: ({ root, props }) => {
        if (!props.open) return true
        const bar = root.querySelector('[role="progressbar"]')
        if (!bar) return '対象がありません'
        const expected = Math.min(100, Math.max(0, props.progress))
        const now = Number(bar.getAttribute('aria-valuenow'))
        return now === expected || `aria-valuenow=${now}, expected=${expected}`
      },
    },
    {
      id: 'steps-rendered',
      description: '検証ケース。',
      check: ({ root, props }) => {
        if (!props.open) return true
        const indicator = root.querySelector('[data-verify-unit="StepIndicator"]')
        if (!indicator) return '対象がありません'
        return (
          indicator.getAttribute('data-verify-count') === String(props.steps.length) ||
          `step count=${indicator.getAttribute('data-verify-count')}`
        )
      },
    },
    {
      id: 'flowtip-iff-provided',
      description: '検証ケース。',
      check: ({ root, props }) => {
        if (!props.open) return true
        const tip = root.querySelector('[data-verify-unit="FlowTip"]')
        const expected = Boolean(props.flowTip)
        return !!tip === expected || `flowTip=${!!tip}, expected=${expected}`
      },
    },
  ],
})
