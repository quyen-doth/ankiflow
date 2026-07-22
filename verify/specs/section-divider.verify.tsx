import type { ComponentProps } from 'react'
import { z } from 'zod'
import { SectionDivider } from '@/components/create/SectionDivider'
import { registerUnit } from '@/verify/core/registry'

type SectionDividerProps = ComponentProps<typeof SectionDivider>

registerUnit<SectionDividerProps>({
  id: 'SectionDivider',
  title: 'SectionDivider',
  description: '検証ケース。',
  kind: 'component',
  render: props => <SectionDivider {...props} />,
  propsSchema: z.object({
    label: z.string(),
  }),
  fixtures: [
    {
      id: 'default',
      description: '検証ケース。',
      props: { label: 'Core Content' },
    },
    {
      id: 'long-label',
      description: '検証ケース。',
      props: { label: 'Configuration and advanced generation options' },
    },
    {
      id: 'probe-empty-label',
      probe: true,
      description: '検証ケース。',
      props: { label: '' },
    },
  ],
  invariants: [
    {
      id: 'label-visible-nonempty',
      description: '検証ケース。',
      check: ({ root }) => {
        const text = root.querySelector('span')?.textContent?.trim() ?? ''
        return text.length > 0 || 'label が空です'
      },
    },
    {
      id: 'label-matches-prop',
      description: 'text label が props.label と一致',
      check: ({ root, props }) =>
        (root.textContent ?? '').includes(props.label) || `見つかりません "${props.label}"`,
    },
  ],
})
