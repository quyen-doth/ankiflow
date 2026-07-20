import type { ComponentProps } from 'react'
import { z } from 'zod'
import { SmartEnrichmentBanner } from '@/components/create/SmartEnrichmentBanner'
import { registerUnit } from '@/verify/core/registry'
import { reactNode } from '@/verify/core/schema-helpers'

type SmartEnrichmentBannerProps = ComponentProps<typeof SmartEnrichmentBanner>

registerUnit<SmartEnrichmentBannerProps>({
  id: 'SmartEnrichmentBanner',
  title: 'SmartEnrichmentBanner',
  description: '検証ケース。',
  kind: 'component',
  render: props => <SmartEnrichmentBanner {...props} />,
  propsSchema: z.object({
    children: reactNode(),
  }),
  fixtures: [
    {
      id: 'plain-text',
      description: '検証ケース。',
      props: { children: 'Our AI will fetch native audio samples.' },
    },
    {
      id: 'rich-children',
      description: '検証ケース。',
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
      description: '検証ケース。',
      props: { children: '' },
    },
  ],
  invariants: [
    {
      id: 'static-title-present',
      description: 'title "Smart Enrichment Active" は常に表示される',
      check: ({ root }) =>
        (root.textContent ?? '').includes('Smart Enrichment Active') ||
        '表示が見つかりません',
    },
    {
      id: 'children-text-rendered',
      description: '検証ケース。',
      onlyFixtures: ['plain-text'],
      check: ({ root }) =>
        (root.textContent ?? '').includes('native audio samples') || 'children が render されていません',
    },
  ],
})
