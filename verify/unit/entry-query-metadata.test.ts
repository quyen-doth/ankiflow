import { describe, expect, it } from 'vitest'
import {
  deriveEntryQueryMetadata,
  entryQueryMetadataMatches,
  findReservedEntryQueryFields,
  isReservedEntryQueryField,
} from '@/lib/entries/queryMetadata'

describe('Entry query metadata', () => {
  it('duplicate semantics と有効な card type IDs から metadata を生成する', () => {
    expect(deriveEntryQueryMetadata({
      word: '  Kubernetes  ',
      term: 'ignored',
      card_type_ids: ['ct-1', '', '  ', 42, 'ct-2', 'ct-2'],
    })).toEqual({
      _query_schema_version: 1,
      _query_duplicate_key: 'kubernetes',
      _query_card_count: 3,
    })
  })

  it('word/term/title の既存優先順位を維持し、不正配列を 0 件として扱う', () => {
    expect(deriveEntryQueryMetadata({ term: 'REST API', title: 'Ignored' }))
      .toMatchObject({ _query_duplicate_key: 'rest api', _query_card_count: 0 })
    expect(deriveEntryQueryMetadata({ title: 'General Topic', card_type_ids: null }))
      .toMatchObject({ _query_duplicate_key: 'general topic', _query_card_count: 0 })
  })

  it('prefix 全体を大小文字・前後空白に関係なく予約する', () => {
    expect(isReservedEntryQueryField('_query_future')).toBe(true)
    expect(isReservedEntryQueryField('  _QUERY_FUTURE  ')).toBe(true)
    expect(isReservedEntryQueryField('query_future')).toBe(false)
    expect(findReservedEntryQueryFields({
      normal: 'ok',
      _query_card_count: 1,
      _query_future: 'blocked',
    })).toEqual(['_query_card_count', '_query_future'])
  })

  it('保存済み metadata の一致を全 managed fields で検証する', () => {
    const data = {
      word: 'Docker',
      card_type_ids: ['a', 'b'],
      _query_schema_version: 1,
      _query_duplicate_key: 'docker',
      _query_card_count: 2,
    }
    expect(entryQueryMetadataMatches(data)).toBe(true)
    expect(entryQueryMetadataMatches({ ...data, _query_card_count: 1 })).toBe(false)
  })
})
