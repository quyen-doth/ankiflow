import { useState } from 'react'
import { z } from 'zod'
import { Select } from '@/components/ui/FormField'
import {
  ALL_HISTORY_FILTERS,
  buildHistoryContentTypeOptions,
  DEFAULT_HISTORY_FILTERS,
  filterHistoryEntries,
} from '@/lib/history/filterEntries'
import { registerUnit } from '@/verify/core/registry'
import { verifyAttrs } from '@/verify/core/contract'
import { FormType } from '@/types'
import type { Entry, FirestoreTimestamp } from '@/types'

interface HistoryContentTypeFilterProps {
  includeAlias: boolean
}

const timestamp: FirestoreTimestamp = {
  seconds: 1,
  nanoseconds: 0,
  toDate: () => new Date(1_000),
}

function entry(id: string, formType: string, primary: string): Entry {
  return {
    id,
    user_id: 'test-user',
    category_id: null,
    form_type: formType,
    word: primary,
    meaning_vi: `${primary} meaning`,
    anki_deck: 'Default',
    card_type_ids: [],
    tags: [],
    created_at: timestamp,
    updated_at: timestamp,
    status: 'draft',
  }
}

const ENTRIES = [
  entry('language-entry', FormType.LANGUAGE, 'serendipity'),
  entry('it-entry', FormType.IT, 'event loop'),
]

function HistoryContentTypeFilter({ includeAlias }: HistoryContentTypeFilterProps) {
  const [contentType, setContentType] = useState<string>(ALL_HISTORY_FILTERS)
  const contentTypes = [
    { code: 'language', name: 'Language', sort_order: 1 },
    { code: 'it', name: 'IT Vocabulary', sort_order: 2 },
    { code: 'general', name: 'General Knowledge', sort_order: 3 },
    ...(includeAlias
      ? [{ code: FormType.LANGUAGE, name: 'Duplicate language alias', sort_order: 4 }]
      : []),
  ]
  const options = buildHistoryContentTypeOptions(contentTypes, ENTRIES)
  const filtered = filterHistoryEntries(ENTRIES, {
    ...DEFAULT_HISTORY_FILTERS,
    contentType,
  })

  return (
    <div {...verifyAttrs({ unit: 'HistoryContentTypeFilter', includeAlias, contentType })}>
      <Select
        aria-label="Content type"
        value={contentType}
        onChange={event => setContentType(event.target.value)}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </Select>
      <output aria-label="Filtered entries">
        {filtered.map(item => item.id).join(',')}
      </output>
    </div>
  )
}

registerUnit<HistoryContentTypeFilterProps>({
  id: 'HistoryContentTypeFilter',
  title: 'History Content Type Filter',
  description: 'Short code と runtime form_* route を同一の History filter として扱う。',
  kind: 'feature',
  render: props => <HistoryContentTypeFilter {...props} />,
  propsSchema: z.object({ includeAlias: z.boolean() }),
  fixtures: [
    {
      id: 'default',
      description: '3 built-in short codes と form_* entries を canonical options に統合する。',
      props: { includeAlias: false },
    },
    {
      id: 'probe-duplicate-alias',
      probe: true,
      description: '同じ route の short/form_* definitions があっても option を重複させない。',
      props: { includeAlias: true },
    },
  ],
  invariants: [
    {
      id: 'canonical-options-unique',
      description: 'Content Type option value は canonical route ごとに一意。',
      check: ({ root }) => {
        const values = Array.from(root.querySelectorAll<HTMLOptionElement>('option'))
          .map(option => option.value)
        return new Set(values).size === values.length || `duplicate values: ${values.join(',')}`
      },
    },
    {
      id: 'three-builtins-present',
      description: 'All に加えて Language、IT、General が一つずつ表示される。',
      check: ({ root }) => {
        const values = Array.from(root.querySelectorAll<HTMLOptionElement>('option'))
          .map(option => option.value)
        const expected = [
          ALL_HISTORY_FILTERS,
          FormType.LANGUAGE,
          FormType.IT,
          FormType.GENERAL,
        ]
        return JSON.stringify(values) === JSON.stringify(expected)
          || `options=${JSON.stringify(values)}`
      },
    },
  ],
})
