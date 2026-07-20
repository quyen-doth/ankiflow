import type { ComponentProps } from 'react'
import { z } from 'zod'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { registerUnit } from '@/verify/core/registry'

type ProgressBarProps = ComponentProps<typeof ProgressBar>

const clamp = (value: number) => Math.min(100, Math.max(0, value))

registerUnit<ProgressBarProps>({
  id: 'ProgressBar',
  title: 'ProgressBar',
  description: '検証ケース。',
  kind: 'component',
  render: props => <ProgressBar {...props} />,
  propsSchema: z.object({
    value: z.number(),
    label: z.string().optional(),
    showPercent: z.boolean().optional(),
    size: z.enum(['sm', 'md']).optional(),
    className: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'zero',
      description: '検証ケース。',
      props: { value: 0 },
    },
    {
      id: 'mid-label-percent',
      description: '検証ケース。',
      props: { value: 45, label: 'Generating', showPercent: true },
    },
    {
      id: 'full',
      description: '検証ケース。',
      props: { value: 100 },
    },
    {
      id: 'probe-overflow',
      probe: true,
      description: '検証ケース。',
      props: { value: 160, showPercent: true },
    },
    {
      id: 'probe-negative',
      probe: true,
      description: '検証ケース。',
      props: { value: -20 },
    },
  ],
  invariants: [
    {
      id: 'progressbar-role',
      description: '検証ケース。',
      check: ({ root }) => {
        const bar = root.querySelector('[role="progressbar"]')
        if (!bar) return '対象がありません'
        return (
          (bar.getAttribute('aria-valuemin') === '0' &&
            bar.getAttribute('aria-valuemax') === '100') ||
          `valuemin=${bar.getAttribute('aria-valuemin')}, valuemax=${bar.getAttribute('aria-valuemax')}`
        )
      },
    },
    {
      id: 'valuenow-clamped',
      description: 'aria-valuenow = clamp(props.value) trong [0,100]',
      check: ({ root, props }) => {
        const bar = root.querySelector('[role="progressbar"]')
        if (!bar) return '対象がありません'
        const now = Number(bar.getAttribute('aria-valuenow'))
        const expected = clamp(props.value)
        return now === expected || `aria-valuenow=${now}, expected=${expected}`
      },
    },
    {
      id: 'width-matches-value',
      description: 'Inline width = `${clamp(value)}%`',
      check: ({ root, props }) => {
        const bar = root.querySelector<HTMLElement>('[role="progressbar"]')
        if (!bar) return '対象がありません'
        const expected = `${clamp(props.value)}%`
        return bar.style.width === expected || `width="${bar.style.width}", expected="${expected}"`
      },
    },
    {
      id: 'percent-text-iff-showPercent',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const text = root.textContent ?? ''
        const has = text.includes(`${clamp(props.value)}%`)
        const expected = Boolean(props.showPercent)
        return has === expected || `percent-text=${has}, expected=${expected}`
      },
    },
    {
      id: 'label-iff-provided',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const has = props.label ? (root.textContent ?? '').includes(props.label) : true
        return has || `label が見つかりません "${props.label}"`
      },
    },
  ],
})
