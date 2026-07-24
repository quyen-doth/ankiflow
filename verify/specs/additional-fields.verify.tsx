import { useState } from 'react'
import { z } from 'zod'
import { AdditionalFieldsSection } from '@/components/review/FlashcardReviewLayout'
import { registerUnit } from '@/verify/core/registry'
import { verifyAttrs } from '@/verify/core/contract'
import type { EntryCustomField } from '@/lib/entryCustomFields'

const INITIAL_FIELDS: EntryCustomField[] = [
  { key: 'phon_the', label: 'Traditional form', value: '喫飯' },
  { key: 'related_words', label: 'Related words', value: ['用餐', '吃東西'] },
  { key: 'register', label: 'Register', value: 'Formal' },
]

interface AdditionalFieldsHarnessProps {
  fieldCount: 2 | 3
}

function AdditionalFieldsHarness({ fieldCount }: AdditionalFieldsHarnessProps) {
  const [fields, setFields] = useState(() => INITIAL_FIELDS.slice(0, fieldCount))
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

registerUnit<AdditionalFieldsHarnessProps>({
  id: 'AdditionalFields',
  title: 'Additional fields',
  description: 'Preview/History で custom string/string[] field を編集する section。',
  kind: 'component',
  render: props => <AdditionalFieldsHarness {...props} />,
  propsSchema: z.object({
    fieldCount: z.union([z.literal(2), z.literal(3)]),
  }),
  fixtures: [
    {
      id: 'custom-values',
      probe: true,
      description: '2 fields を全幅 1 column で label と値付きで表示する。',
      props: { fieldCount: 2 },
    },
    {
      id: 'many-fields',
      description: '3 fields 以上を responsive 2 column で表示する。',
      props: { fieldCount: 3 },
    },
  ],
  invariants: [
    {
      id: 'custom-values-visible',
      description: 'section title、label、配列の各値を表示する',
      check: ({ root }) => {
        const text = root.textContent ?? ''
        const expected = ['Additional fields (2)', 'Traditional form', '喫飯', 'Related words', '用餐', '吃東西']
        const missing = expected.find(value => !text.includes(value))
        return missing ? `表示されていない値: ${missing}` : true
      },
      onlyFixtures: ['custom-values'],
    },
    {
      id: 'field-count-and-value-size',
      description: 'section title に件数を表示し、値を 15px で表示する',
      check: ({ root, props }) => {
        const heading = root.querySelector('[data-testid="additional-fields"] > p')
        if (heading?.textContent?.trim() !== `Additional fields (${props.fieldCount})`) {
          return `件数付き title が不正: ${heading?.textContent ?? 'missing'}`
        }
        const values = root.querySelectorAll('[data-testid="additional-fields"] [data-verify-unit="EditableField"]')
        const wrongSize = Array.from(values).find(value => !value.classList.contains('text-[15px]'))
        return wrongSize ? '15px でない追加 field 値がある' : true
      },
    },
    {
      id: 'responsive-columns',
      description: '2 fields は 1 column、3 fields 以上は sm で 2 column にする',
      check: ({ root, props }) => {
        const grid = root.querySelector('[data-testid="additional-fields-grid"]')
        if (!grid?.classList.contains('grid-cols-1')) return 'base 1 column class がない'
        const hasTwoColumns = grid.classList.contains('sm:grid-cols-2')
        return hasTwoColumns === (props.fieldCount > 2)
          ? true
          : `${props.fieldCount} fields の responsive column class が不正`
      },
    },
  ],
})
