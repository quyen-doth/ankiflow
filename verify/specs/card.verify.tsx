import type { ComponentProps } from 'react'
import { z } from 'zod'
import { Card } from '@/components/ui/Card'
import { registerUnit } from '@/verify/core/registry'
import { reactNode } from '@/verify/core/schema-helpers'

type CardProps = ComponentProps<typeof Card>

registerUnit<CardProps>({
  id: 'Card',
  title: 'Card',
  description: '検証ケース。',
  kind: 'component',
  render: props => <Card {...props} />,
  propsSchema: z.object({
    children: reactNode(),
    className: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'default',
      description: '検証ケース。',
      props: { children: 'Card content' },
    },
    {
      id: 'nested-content',
      description: 'ネストした content (heading + paragraph)。',
      props: {
        children: (
          <div>
            <h3>タイトル</h3>
            <p>card 内部の説明文。</p>
          </div>
        ),
      },
    },
    {
      id: 'probe-empty-children',
      probe: true,
      description: '検証ケース。',
      props: { children: null },
    },
  ],
  invariants: [
    {
      id: 'children-inside-root',
      description: '検証ケース。',
      check: ({ root, fixture }) => {
        const el = root.querySelector('[data-verify-unit="Card"]')
        if (!el) return '要素が見つかりません'
        if (fixture.id === 'probe-empty-children') return true
        return (el.textContent ?? '').trim().length > 0 || '対象がありません'
      },
    },
  ],
})
