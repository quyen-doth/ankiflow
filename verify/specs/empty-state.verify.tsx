import type { ComponentProps } from 'react'
import { z } from 'zod'
import { EmptyState } from '@/components/ui/EmptyState'
import { registerUnit } from '@/verify/core/registry'
import { reactNode } from '@/verify/core/schema-helpers'

type EmptyStateProps = ComponentProps<typeof EmptyState>

registerUnit<EmptyStateProps>({
  id: 'EmptyState',
  title: 'EmptyState',
  description: 'Placeholder trạng thái rỗng: icon, title, description, action.',
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
      description: 'Chỉ có title.',
      props: { title: 'No entries yet' },
    },
    {
      id: 'full',
      description: 'Đầy đủ icon + description + action.',
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
      description: 'Probe (EXPECTED_FAIL): title rỗng — empty state mất tiêu đề.',
      props: { title: '' },
    },
  ],
  invariants: [
    {
      id: 'title-visible',
      description: 'Title phải hiển thị (không rỗng)',
      check: ({ root, props }) => {
        if (!props.title.trim()) return 'title rỗng'
        return (root.textContent ?? '').includes(props.title) || `không thấy title "${props.title}"`
      },
    },
    {
      id: 'action-iff-provided',
      description: 'Action slot render khi và chỉ khi có props.action',
      check: ({ root, props, contract }) => {
        const expected = props.action != null
        if (contract.hasaction !== String(expected)) {
          return `contract.hasaction="${contract.hasaction}", expected=${expected}`
        }
        return true
      },
    },
    {
      id: 'description-iff-provided',
      description: 'Description render khi và chỉ khi có props.description',
      check: ({ root, props }) => {
        if (!props.description) return true
        return (
          (root.textContent ?? '').includes(props.description) ||
          `không thấy description`
        )
      },
    },
  ],
})
