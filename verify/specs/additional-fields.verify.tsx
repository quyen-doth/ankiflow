import { useState } from 'react'
import { z } from 'zod'
import { AdditionalFieldsSection } from '@/components/review/FlashcardReviewLayout'
import { registerUnit } from '@/verify/core/registry'
import { verifyAttrs } from '@/verify/core/contract'
import type { EntryCustomField } from '@/lib/entryCustomFields'

const INITIAL_FIELDS: EntryCustomField[] = [
  { key: 'phon_the', label: 'Traditional form', value: '喫飯' },
  { key: 'related_words', label: 'Related words', value: ['用餐', '吃東西'] },
]

function AdditionalFieldsHarness() {
  const [fields, setFields] = useState(INITIAL_FIELDS)
  const [lastKey, setLastKey] = useState('')
  const related = fields.find(field => field.key === 'related_words')?.value

  return (
    <div {...verifyAttrs({
      unit: 'AdditionalFields',
      count: fields.length,
      lastKey,
      related: Array.isArray(related) ? related.join('|') : 'invalid',
    })}>
      <AdditionalFieldsSection
        fields={fields}
        onChange={(key, value) => {
          setFields(current => current.map(field => (
            field.key === key ? { ...field, value } : field
          )))
          setLastKey(key)
        }}
      />
    </div>
  )
}

registerUnit<Record<string, never>>({
  id: 'AdditionalFields',
  title: 'Additional fields',
  description: 'Preview/History で custom string/string[] field を編集する section。',
  kind: 'component',
  render: () => <AdditionalFieldsHarness />,
  propsSchema: z.object({}),
  fixtures: [{
    id: 'custom-values',
    probe: true,
    description: 'Custom string と string array を label 付きで表示する。',
    props: {},
  }],
  invariants: [
    {
      id: 'custom-values-visible',
      description: 'section title、label、配列の各値を表示する',
      check: ({ root }) => {
        const text = root.textContent ?? ''
        const expected = ['Additional fields', 'Traditional form', '喫飯', 'Related words', '用餐', '吃東西']
        const missing = expected.find(value => !text.includes(value))
        return missing ? `表示されていない値: ${missing}` : true
      },
    },
  ],
})
