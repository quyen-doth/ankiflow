import type { ComponentProps } from 'react'
import { z } from 'zod'
import { EmptyState } from '@/components/ui/EmptyState'
import { registerUnit } from '@/verify/core/registry'
import { reactNode } from '@/verify/core/schema-helpers'

type EmptyStateProps = ComponentProps<typeof EmptyState>

registerUnit<EmptyStateProps>({
  id: 'EmptyState',
  title: 'EmptyState',
  description: '検証ケース。',
  kind: 'component',
  render: props => <EmptyState {...props} />,
  propsSchema: z.object({
    icon: reactNode().optional(),
    title: z.string(),
    description: z.string().optional(),
    action: reactNode().optional(),
    className: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'title-only',
      description: '検証ケース。',
      props: { title: 'No entries yet' },
    },
    {
      id: 'full',
      description: '検証ケース。',
      props: {
        icon: <span data-icon="empty">📭</span>,
        title: 'No entries yet',
        description: 'Create your first card to get started.',
        action: <button type="button">Create card</button>,
      },
    },
    {
      id: 'probe-empty-title',
      probe: true,
      description: '検証ケース。',
      props: { title: '' },
    },
  ],
  invariants: [
    {
      id: 'title-visible',
      description: '検証ケース。',
      check: ({ root, props }) => {
        if (!props.title.trim()) return 'title rỗng'
        return (root.textContent ?? '').includes(props.title) || `title が見つかりません "${props.title}"`
      },
    },
    {
      id: 'action-iff-provided',
      description: '検証ケース。',
      check: ({ props, contract }) => {
        const expected = props.action != null
        if (contract.hasaction !== String(expected)) {
          return `contract.hasaction="${contract.hasaction}", expected=${expected}`
        }
        return true
      },
    },
    {
      id: 'description-iff-provided',
      description: '検証ケース。',
      check: ({ root, props }) => {
        if (!props.description) return true
        return (
          (root.textContent ?? '').includes(props.description) ||
          `表示が見つかりません`
        )
      },
    },
  ],
})
