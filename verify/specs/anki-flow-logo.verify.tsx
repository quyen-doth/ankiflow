import type { ComponentProps } from 'react'
import { z } from 'zod'
import { AnkiFlowLogo } from '@/components/ui/AnkiFlowLogo'
import { registerUnit } from '@/verify/core/registry'

type AnkiFlowLogoProps = ComponentProps<typeof AnkiFlowLogo>

registerUnit<AnkiFlowLogoProps>({
  id: 'AnkiFlowLogo',
  title: 'AnkiFlowLogo',
  description: 'Brand mark: icon thẻ + tên app + slogan; bọc Link khi có href.',
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
      description: 'Mặc định: size md, link về /dashboard.',
      props: {},
    },
    {
      id: 'sm',
      description: 'Size sm.',
      props: { size: 'sm' },
    },
    {
      id: 'custom-href',
      description: 'Link tùy chỉnh.',
      props: { href: '/create' },
    },
    {
      id: 'probe-empty-href',
      probe: true,
      description: 'Probe: href rỗng → không bọc Link, vẫn render đủ nội dung.',
      props: { href: '' },
    },
  ],
  invariants: [
    {
      id: 'brand-text-rendered',
      description: 'Hiển thị tên "AnkiFlow"',
      check: ({ root }) =>
        (root.textContent ?? '').includes('AnkiFlow') || 'không thấy text AnkiFlow',
    },
    {
      id: 'tagline-rendered',
      description: 'Hiển thị slogan "Knowledge in Flow"',
      check: ({ root }) =>
        (root.textContent ?? '').includes('Knowledge in Flow') || 'không thấy slogan Knowledge in Flow',
    },
    {
      id: 'icon-present',
      description: 'Có icon svg',
      check: ({ root }) => !!root.querySelector('svg') || 'không có svg',
    },
    {
      id: 'link-iff-href',
      description: 'Bọc <a> khi và chỉ khi href truthy',
      check: ({ root, props }) => {
        const link = root.querySelector('a')
        // href mặc định '/dashboard' khi không truyền; '' → không link
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
