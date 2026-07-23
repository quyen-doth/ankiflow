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

  it('single preview は AI content より session/application metadata を優先する', () => {
    const entry = mapPendingEntryToPreview(makeEntry({
      language: 'en',
      outputLanguage: 'vi',
      generatedContent: {
        term: 'Event Loop',
        form_type: 'forged',
        language: 'ja',
        output_language: 'en',
        anki_deck: 'forged',
        category_id: 'forged',
        card_type_ids: ['forged'],
        tags: ['forged'],
        topic_ids: ['forged'],
      },
    }), 'IT::Runtime')

    expect(entry).toMatchObject({
      form_type: FormType.IT,
      language: 'en',
      output_language: 'vi',
      anki_deck: 'IT::Runtime',
      category_id: 'category-it',
      card_type_ids: ['card-type-it'],
      tags: ['javascript'],
      topic_ids: ['topic-runtime'],
    })
  })

  it('batch preview は aliases を補い、trusted metadata を全 item に適用する', () => {
    const entries = mapPendingBatchToPreview(makeBatch({
      outputLanguage: 'en',
      items: [{
        term: 'Event Loop',
        definition_vi: 'Runtime scheduler',
        example_usage: 'Runs queued callbacks',
        form_type: 'forged',
        output_language: 'vi',
      }, {
        term: 'Microtask Queue',
        word_type_vi: 'concept',
        tags: ['forged'],
      }],
    }), 'IT::Runtime')

    expect(entries[0]).toMatchObject({
      definition: 'Runtime scheduler',
      example_sentence: 'Runs queued callbacks',
      form_type: FormType.IT,
      output_language: 'en',
    })
    expect(entries[1]).toMatchObject({
      word_type: 'concept',
      tags: ['javascript'],
    })
  })

  it('batch preview は各 item の custom string/string[] を保持する', () => {
    const entries = mapPendingBatchToPreview(makeBatch({
      formType: FormType.LANGUAGE,
      language: 'zh',
      items: [
        { word: '吃饭', phon_the: '喫飯', related_words: ['用餐', '吃東西'] },
        { word: '学习', phon_the: '學習', related_words: ['讀書'] },
      ],
    }), 'Chinese') as Array<Record<string, unknown>>

    expect(entries.map(entry => ({
      phon_the: entry.phon_the,
      related_words: entry.related_words,
    }))).toEqual([
      { phon_the: '喫飯', related_words: ['用餐', '吃東西'] },
      { phon_the: '學習', related_words: ['讀書'] },
    ])
  })
})
