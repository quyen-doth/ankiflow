import { useState } from 'react'
import { z } from 'zod'
import { CardPreview, CardStructureEditor } from '@/components/admin/CardTemplateEditor'
import { registerUnit } from '@/verify/core/registry'
import { verifyAttrs } from '@/verify/core/contract'
import type { CardTemplate } from '@/types'
import type { CardTemplateCustomField } from '@/lib/anki/cardTemplateFields'

const CUSTOM_FIELDS: CardTemplateCustomField[] = [
  {
    key: 'phon_the',
    source: 'custom:phon_the',
    label: 'Traditional form',
    sampleValue: 'Sample Traditional form',
  },
  {
    key: 'related_words',
    source: 'custom:related_words',
    label: 'Related words',
    sampleValue: ['Sample Related words 1', 'Sample Related words 2'],
  },
]

function CardTemplateEditorHarness() {
  const [template, setTemplate] = useState<CardTemplate>({
    front: ['word'],
    back: ['meaning'],
  })

  return (
    <div {...verifyAttrs({ unit: 'CardTemplateEditor', back: template.back.join(',') })}>
      <CardStructureEditor
        code="word_to_meaning"
        template={template}
        customFields={CUSTOM_FIELDS}
        onChange={setTemplate}
      />
      <CardPreview template={template} language="zh" customFields={CUSTOM_FIELDS} />
    </div>
  )
}

registerUnit<Record<string, never>>({
  id: 'CardTemplateEditor',
  title: 'Card Template Editor',
  description: 'Content Type profile の custom field options と preview を検証する。',
  kind: 'component',
  render: () => <CardTemplateEditorHarness />,
  propsSchema: z.object({}),
  fixtures: [
    {
      id: 'custom-options',
      probe: true,
      description: 'builtin capability と custom fields を Front/Back の追加候補として表示する。',
      props: {},
    },
    {
      id: 'act-add-example-audio',
      description: 'Example audio builtin を追加すると preview chip を表示する。',
      props: {},
      act: async ctx => {
        const select = ctx.root.querySelector<HTMLSelectElement>('select[aria-label="Add field to back"]')
        if (!select) throw new Error('back field select が見つからない')
        select.value = 'audio_example'
        select.dispatchEvent(new Event('change', { bubbles: true }))
        await ctx.wait(0)
      },
    },
  ],
  invariants: [
    {
      id: 'custom-options-visible',
      description: 'custom source と label が追加 select に含まれる',
      onlyFixtures: ['custom-options'],
      check: ({ root }) => {
        const select = root.querySelector<HTMLSelectElement>('select[aria-label="Add field to back"]')
        const options = Array.from(select?.options ?? [])
        const traditional = options.find(option => option.value === 'custom:phon_the')
        const related = options.find(option => option.value === 'custom:related_words')
        const exampleAudio = options.find(option => option.value === 'audio_example')
        if (traditional?.textContent !== 'Traditional form') return 'Traditional form option がない'
        if (related?.textContent !== 'Related words') return 'Related words option がない'
        return exampleAudio?.textContent === 'Example audio' || 'Example audio option がない'
      },
    },
    {
      id: 'example-audio-preview-visible',
      description: 'Example audio block は admin preview で専用 chip を表示する',
      onlyFixtures: ['act-add-example-audio'],
      check: ({ root }) => {
        const iframe = root.querySelector<HTMLIFrameElement>('iframe[title="Card preview"]')
        return iframe?.getAttribute('srcdoc')?.includes('🔊 Example audio')
          || 'Example audio preview chip が表示されない'
      },
    },
  ],
})
