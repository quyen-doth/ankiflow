import type { ComponentProps } from 'react'
import { z } from 'zod'
import { Card } from '@/components/ui/Card'
import { registerUnit } from '@/verify/core/registry'
import { reactNode } from '@/verify/core/schema-helpers'

type CardProps = ComponentProps<typeof Card>

registerUnit<CardProps>({
  id: 'Card',
  title: 'Card',
  description: 'Container wrapper: nền trắng, bo góc, shadow, border.',
  kind: 'component',
  render: props => <Card {...props} />,
  propsSchema: z.object({
    children: reactNode(),
    className: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'default',
      description: 'Nội dung text đơn giản.',
      props: { children: 'Card content' },
    },
    {
      id: 'nested-content',
      description: 'Nội dung lồng nhau (heading + paragraph).',
      props: {
        children: (
          <div>
            <h3>Tiêu đề</h3>
            <p>Đoạn mô tả bên trong card.</p>
          </div>
        ),
      },
    },
    {
      id: 'probe-empty-children',
      probe: true,
      description: 'Probe: children rỗng — card vẫn render không crash.',
      props: { children: null },
    },
  ],
  invariants: [
    {
      id: 'children-inside-root',
      description: 'Children render bên trong root Card',
      check: ({ root, fixture }) => {
        const el = root.querySelector('[data-verify-unit="Card"]')
        if (!el) return 'không tìm thấy root Card'
        if (fixture.id === 'probe-empty-children') return true
        return (el.textContent ?? '').trim().length > 0 || 'card không có nội dung'
      },
    },
  ],
})
