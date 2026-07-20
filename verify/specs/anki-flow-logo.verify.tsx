import type { ComponentProps } from 'react'
import { z } from 'zod'
import { AnkiFlowLogo } from '@/components/ui/AnkiFlowLogo'
import { registerUnit } from '@/verify/core/registry'

type AnkiFlowLogoProps = ComponentProps<typeof AnkiFlowLogo>

registerUnit<AnkiFlowLogoProps>({
  id: 'AnkiFlowLogo',
  title: 'AnkiFlowLogo',
  description: '検証ケース。',
  kind: 'component',
  render: props => <AnkiFlowLogo {...props} />,
  propsSchema: z.object({
    href: z.string().optional(),
    className: z.string().optional(),
    size: z.enum(['sm', 'md']).optional(),
  }),
  fixtures: [
    {
      id: 'default',
      description: '検証ケース。',
      props: {},
    },
    {
      id: 'sm',
      description: 'Size sm.',
      props: { size: 'sm' },
    },
    {
      id: 'custom-href',
      description: '検証ケース。',
      props: { href: '/create' },
    },
    {
      id: 'probe-empty-href',
      probe: true,
      description: '検証ケース。',
      props: { href: '' },
    },
  ],
  invariants: [
    {
      id: 'brand-text-rendered',
      description: 'name "AnkiFlow" を表示',
      check: ({ root }) =>
        (root.textContent ?? '').includes('AnkiFlow') || '表示が見つかりません',
    },
    {
      id: 'tagline-rendered',
      description: 'slogan "Knowledge in Flow" を表示',
      check: ({ root }) =>
        (root.textContent ?? '').includes('Knowledge in Flow') || '表示が見つかりません',
    },
    {
      id: 'icon-present',
      description: '検証ケース。',
      check: ({ root }) => !!root.querySelector('svg') || '対象がありません',
    },
    {
      id: 'link-iff-href',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const link = root.querySelector('a')
        // 検証用コメント。
        const expectedHref = props.href === undefined ? '/dashboard' : props.href
        const expected = Boolean(expectedHref)
        if (!!link !== expected) return `link=${!!link}, expected=${expected}`
        if (link && link.getAttribute('href') !== expectedHref) {
          return `href="${link.getAttribute('href')}", expected="${expectedHref}"`
        }
        return true
      },
    },
  ],
})
