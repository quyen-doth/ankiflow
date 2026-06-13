import type { ComponentProps } from 'react'
import { z } from 'zod'
import { SectionDivider } from '@/components/create/SectionDivider'
import { registerUnit } from '@/verify/core/registry'

type SectionDividerProps = ComponentProps<typeof SectionDivider>

registerUnit<SectionDividerProps>({
  id: 'SectionDivider',
  title: 'SectionDivider',
  description: 'Đường kẻ chia section với label uppercase ở giữa.',
  kind: 'component',
  render: props => <SectionDivider {...props} />,
  propsSchema: z.object({
    label: z.string(),
  }),
  fixtures: [
    {
      id: 'default',
      description: 'Label thường.',
      props: { label: 'Core Content' },
    },
    {
      id: 'long-label',
      description: 'Label dài — vẫn nằm giữa hai đường kẻ.',
      props: { label: 'Configuration and advanced generation options' },
    },
    {
      id: 'probe-empty-label',
      probe: true,
      description: 'Probe (EXPECTED_FAIL): label rỗng — divider không có chữ.',
      props: { label: '' },
    },
  ],
  invariants: [
    {
      id: 'label-visible-nonempty',
      description: 'Label hiển thị và không rỗng',
      check: ({ root }) => {
        const text = root.querySelector('span')?.textContent?.trim() ?? ''
        return text.length > 0 || 'label rỗng'
      },
    },
    {
      id: 'label-matches-prop',
      description: 'Text label khớp props.label',
      check: ({ root, props }) =>
        (root.textContent ?? '').includes(props.label) || `không thấy "${props.label}"`,
    },
  ],
})
