import type { ComponentProps } from 'react'
import { z } from 'zod'
import { SmartEnrichmentBanner } from '@/components/create/SmartEnrichmentBanner'
import { registerUnit } from '@/verify/core/registry'
import { reactNode } from '@/verify/core/schema-helpers'

type SmartEnrichmentBannerProps = ComponentProps<typeof SmartEnrichmentBanner>

registerUnit<SmartEnrichmentBannerProps>({
  id: 'SmartEnrichmentBanner',
  title: 'SmartEnrichmentBanner',
  description: 'Banner thông báo AI enrichment trên các form create.',
  kind: 'component',
  render: props => <SmartEnrichmentBanner {...props} />,
  propsSchema: z.object({
    children: reactNode(),
  }),
  fixtures: [
    {
      id: 'plain-text',
      description: 'Children là text thuần.',
      props: { children: 'Our AI will fetch native audio samples.' },
    },
    {
      id: 'rich-children',
      description: 'Children có markup strong bên trong.',
      props: {
        children: (
          <>
            Our AI will fetch <strong>audio samples</strong> and <strong>context sentences</strong>.
          </>
        ),
      },
    },
    {
      id: 'probe-empty-children',
      probe: true,
      description: 'Probe: children rỗng — banner vẫn render tiêu đề, không crash.',
      props: { children: '' },
    },
  ],
  invariants: [
    {
      id: 'static-title-present',
      description: 'Tiêu đề "Smart Enrichment Active" luôn hiển thị',
      check: ({ root }) =>
        (root.textContent ?? '').includes('Smart Enrichment Active') ||
        'không thấy tiêu đề banner',
    },
    {
      id: 'children-text-rendered',
      description: 'Nội dung children render bên trong banner',
      onlyFixtures: ['plain-text'],
      check: ({ root }) =>
        (root.textContent ?? '').includes('native audio samples') || 'children không render',
    },
  ],
})
