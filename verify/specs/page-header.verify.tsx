import type { ComponentProps } from 'react'
import { z } from 'zod'
import { PageHeader } from '@/components/layout/PageHeader'
import { registerUnit } from '@/verify/core/registry'
import { reactNode } from '@/verify/core/schema-helpers'

type PageHeaderProps = ComponentProps<typeof PageHeader>

registerUnit<PageHeaderProps>({
  id: 'PageHeader',
  title: 'PageHeader',
  description: 'Header trang: breadcrumb, title (serif), description, actions.',
  kind: 'component',
  render: props => <PageHeader {...props} />,
  propsSchema: z.object({
    title: z.string().optional(),
    crumbs: z.array(z.object({ label: z.string(), href: z.string().optional() })).optional(),
    description: z.string().optional(),
    actions: reactNode().optional(),
    className: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'title-only',
      description: 'Chỉ có title.',
      props: { title: 'Settings' },
    },
    {
      id: 'with-crumbs-desc-actions',
      description: 'Breadcrumb 2 cấp (cấp giữa có link) + description + actions.',
      props: {
        crumbs: [
          { label: 'Library', href: '/history' },
          { label: 'Detail' },
        ],
        description: 'Full entry view with recreate and delete.',
        actions: <button type="button">Export</button>,
      },
    },
    {
      id: 'probe-empty-crumbs',
      probe: true,
      description: 'Probe: crumbs rỗng + không title — header rỗng nhưng không crash.',
      props: { crumbs: [] },
    },
  ],
  invariants: [
    {
      id: 'crumbs-contract-matches',
      description: 'data-verify-crumbs = crumbs.length',
      check: ({ contract, props }) =>
        Number(contract.crumbs) === (props.crumbs?.length ?? 0) ||
        `contract.crumbs=${contract.crumbs}`,
    },
    {
      id: 'breadcrumb-iff-crumbs',
      description: 'Nav breadcrumb hiện khi và chỉ khi có crumbs',
      check: ({ root, props }) => {
        const nav = root.querySelector('nav[aria-label="Breadcrumb"]')
        const expected = (props.crumbs?.length ?? 0) > 0
        return !!nav === expected || `nav=${!!nav}, expected=${expected}`
      },
    },
    {
      id: 'title-falls-back-to-last-crumb',
      description: 'H1 = title, hoặc label crumb cuối khi không có title',
      check: ({ root, props }) => {
        const expected = props.title ?? props.crumbs?.[props.crumbs.length - 1]?.label
        const h1 = root.querySelector('h1')
        if (!expected) return !h1 || 'h1 xuất hiện dù không có title/crumb'
        if (!h1) return `không có h1, expected "${expected}"`
        return h1.textContent?.trim() === expected || `h1="${h1.textContent}", expected="${expected}"`
      },
    },
    {
      id: 'crumb-link-count',
      description: 'Số link trong breadcrumb = 1 (home) + crumb có href trừ crumb cuối',
      check: ({ root, props }) => {
        const crumbs = props.crumbs ?? []
        if (crumbs.length === 0) return true
        const links = root.querySelectorAll('nav[aria-label="Breadcrumb"] a').length
        const expected =
          1 + crumbs.filter((c, i) => c.href && i < crumbs.length - 1).length
        return links === expected || `links=${links}, expected=${expected}`
      },
    },
  ],
})
