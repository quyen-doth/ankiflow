import { describe, expect, it } from 'vitest'
import {
  ALL_HISTORY_FILTERS,
  DEFAULT_HISTORY_FILTERS,
  filterHistoryEntries,
  type HistoryFilters,
} from '@/lib/history/filterEntries'
import { FormType, type Entry, type FirestoreTimestamp } from '@/types'

const timestamp: FirestoreTimestamp = {
  seconds: 1,
  nanoseconds: 0,
  toDate: () => new Date(1_000),
}

function makeEntry(overrides: Partial<Entry>): Entry {
  return {
    id: 'entry',
    user_id: 'user-1',
    category_id: null,
    form_type: FormType.LANGUAGE,
    language: 'en',
    word: 'serendipity',
    meaning_vi: 'fortunate discovery',
    anki_deck: 'Default',
    card_type_ids: [],
    tags: [],
    created_at: timestamp,
    updated_at: timestamp,
    status: 'draft',
    ...overrides,
  }
}

const entries: Entry[] = [
  makeEntry({ id: 'language-draft' }),
  makeEntry({
    id: 'language-synced',
    language: 'pt_BR',
    word: 'saudade',
    meaning_vi: 'longing',
    status: 'synced',
  }),
  makeEntry({
    id: 'it-reviewed',
    form_type: FormType.IT,
    language: undefined,
    word: undefined,
    term: 'Event Loop',
    meaning_vi: undefined,
    definition: 'Asynchronous execution mechanism',
    status: 'reviewed',
  }),
  makeEntry({
    id: 'custom-synced',
    form_type: 'medical_term',
    language: undefined,
    word: undefined,
    title: 'Tachycardia',
    meaning_vi: undefined,
    content: 'Elevated heart rate',
    status: 'synced',
  }),
]

function filters(overrides: Partial<HistoryFilters>): HistoryFilters {
  return { ...DEFAULT_HISTORY_FILTERS, ...overrides }
}

describe('filterHistoryEntries', () => {
  it('フィルター未指定では全 entry を維持する', () => {
    expect(filterHistoryEntries(entries, DEFAULT_HISTORY_FILTERS)).toEqual(entries)
  })

  it('draft を含む status で絞り込む', () => {
    const result = filterHistoryEntries(entries, filters({ status: 'draft' }))
    expect(result.map(entry => entry.id)).toEqual(['language-draft'])
  })

  it('削除済み定義を含む custom content type code で絞り込む', () => {
    const result = filterHistoryEntries(entries, filters({ contentType: 'medical_term' }))
    expect(result.map(entry => entry.id)).toEqual(['custom-synced'])
  })

  it('Language 選択時だけ canonical language code を適用する', () => {
    const languageResult = filterHistoryEntries(entries, filters({
      contentType: FormType.LANGUAGE,
      language: 'pt-BR',
    }))
    const itResult = filterHistoryEntries(entries, filters({
      contentType: FormType.IT,
      language: 'pt-BR',
    }))

    expect(languageResult.map(entry => entry.id)).toEqual(['language-synced'])
    expect(itResult.map(entry => entry.id)).toEqual(['it-reviewed'])
  })

  it('primary field と meaning field を大文字小文字を区別せず検索する', () => {
    expect(filterHistoryEntries(entries, filters({ search: 'EVENT' })).map(entry => entry.id))
      .toEqual(['it-reviewed'])
    expect(filterHistoryEntries(entries, filters({ search: 'heart RATE' })).map(entry => entry.id))
      .toEqual(['custom-synced'])
  })

  it('content type、language、status、search を組み合わせる', () => {
    const result = filterHistoryEntries(entries, {
      search: 'long',
      contentType: FormType.LANGUAGE,
      language: 'pt-BR',
      status: 'synced',
    })
    expect(result.map(entry => entry.id)).toEqual(['language-synced'])
  })

  it('all language は Language entries を追加で制限しない', () => {
    const result = filterHistoryEntries(entries, filters({
      contentType: FormType.LANGUAGE,
      language: ALL_HISTORY_FILTERS,
    }))
    expect(result.map(entry => entry.id)).toEqual(['language-draft', 'language-synced'])
  })
})
