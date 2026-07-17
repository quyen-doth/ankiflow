import { describe, expect, it } from 'vitest'
import { mapPendingBatchToPreview } from '@/hooks/usePreviewBatch'
import { mapPendingEntryToPreview } from '@/hooks/usePreviewEntry'
import type { PendingBatch } from '@/lib/pendingBatch'
import type { PendingEntry } from '@/lib/pendingEntry'
import { FormType } from '@/types'

function makeEntry(overrides: Partial<PendingEntry> = {}): PendingEntry {
  return {
    generatedContent: { term: 'Event Loop', topic_ids: ['ai-topic'] },
    formType: FormType.IT,
    deckId: 'deck-it',
    categoryId: 'category-it',
    cardTypeIds: ['card-type-it'],
    topicIds: ['topic-runtime'],
    tags: ['javascript'],
    savedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeBatch(overrides: Partial<PendingBatch> = {}): PendingBatch {
  return {
    items: [{ term: 'Event Loop' }, { term: 'Microtask Queue' }],
    formType: FormType.IT,
    deckId: 'deck-it',
    categoryId: 'category-it',
    cardTypeIds: ['card-type-it'],
    topicIds: ['topic-runtime'],
    tags: ['javascript'],
    savedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('preview Topic mapping', () => {
  it('single preview は user が選んだ topic_ids を AI 出力より優先する', () => {
    const entry = mapPendingEntryToPreview(makeEntry(), 'IT::Runtime')
    expect(entry.topic_ids).toEqual(['topic-runtime'])
  })

  it('batch preview は全 Entry に同じ topic_ids を引き継ぐ', () => {
    const entries = mapPendingBatchToPreview(makeBatch(), 'IT::Runtime')
    expect(entries.map(entry => entry.topic_ids)).toEqual([
      ['topic-runtime'],
      ['topic-runtime'],
    ])
  })

  it('旧 IT pending に topicIds がない場合は空配列へフォールバックする', () => {
    const single = mapPendingEntryToPreview(makeEntry({ topicIds: undefined }), 'IT::Runtime')
    const batch = mapPendingBatchToPreview(makeBatch({ topicIds: undefined }), 'IT::Runtime')
    expect(single.topic_ids).toEqual([])
    expect(batch.every(entry => entry.topic_ids?.length === 0)).toBe(true)
  })

  it('IT 以外の Entry には topic_ids を追加しない', () => {
    const entry = mapPendingEntryToPreview(makeEntry({
      formType: FormType.GENERAL,
      generatedContent: { title: 'CAP theorem' },
    }), 'General')
    expect(entry).not.toHaveProperty('topic_ids')
  })
})
