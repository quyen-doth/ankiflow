import { z } from 'zod'
import { ContentTypeEditor } from '@/components/admin/ContentTypeEditor'
import { registerUnit } from '@/verify/core/registry'
import { clickButtonByText } from './manager-helpers'

registerUnit({
  id: 'ContentTypeDataSourceEditor',
  title: 'ContentType data source editor',
  description: 'Content Type の system data source 設定を検証する。',
  kind: 'component',
  render: () => (
    <ContentTypeEditor
      contentType={null}
      scope="workspace"
      onSaved={() => undefined}
      onCancel={() => undefined}
    />
  ),
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'configure-output-language',
      probe: true,
      description: '空 field に AI output languages を設定すると互換 field 設定を補完する。',
      props: {},
      act: async ctx => {
        clickButtonByText(ctx.root, 'Add Field')
        await ctx.wait(0)
        const select = ctx.root.querySelector<HTMLSelectElement>(
          'select[aria-label="Data source for field 0"]',
        )
        if (!select) throw new Error('Data source select が見つからない')
        select.value = 'output_languages'
        select.dispatchEvent(new Event('change', { bubbles: true }))
        await ctx.wait(0)
      },
    },
  ],
  invariants: [
    {
      id: 'output-language-source-configures-field',
      description: 'AI output languages は key/label/dropdown を補完し static options を表示しない。',
      onlyFixtures: ['configure-output-language'],
      check: ({ root }) => {
        const source = root.querySelector<HTMLSelectElement>(
          'select[aria-label="Data source for field 0"]',
        )
        const key = root.querySelector<HTMLInputElement>('input[aria-label="Field key 0"]')
        const label = root.querySelector<HTMLInputElement>('input[aria-label="Label for field 0"]')
        const type = root.querySelector<HTMLSelectElement>('select[aria-label="Type for field 0"]')
        const options = root.querySelector<HTMLInputElement>('input[aria-label="Options for field 0"]')
        if (source?.value !== 'output_languages') return `source="${source?.value}"`
        if (key?.value !== 'output_language') return `key="${key?.value}"`
        if (label?.value !== 'AI output language') return `label="${label?.value}"`
        if (type?.value !== 'dropdown') return `type="${type?.value}"`
        return options === null || 'system data source に static options が表示されている'
      },
    },
  ],
})
