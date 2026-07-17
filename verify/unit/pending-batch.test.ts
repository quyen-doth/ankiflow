import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearPendingBatch,
  isPendingBatchStale,
  loadPendingBatch,
  savePendingBatch,
  type PendingBatch,
} from '@/lib/pendingBatch'
import { FormType, LanguageType } from '@/types'

function makeBatch(overrides: Partial<PendingBatch> = {}): PendingBatch {
  return {
    items: [
      { word: 'serendipity', meaning_vi: 'sự tình cờ may mắn' },
      { word: 'ephemeral', meaning_vi: 'phù du' },
    ],
    formType: FormType.LANGUAGE,
    language: LanguageType.ENGLISH,
    deckId: 'd1',
    categoryId: 'c1',
    cardTypeIds: ['ct1', 'ct2'],
    tags: ['vocab'],
    savedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('lib/pendingBatch', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('savePendingBatch → loadPendingBatch round-trip', () => {
    const batch = makeBatch()
    savePendingBatch(batch)
    expect(loadPendingBatch()).toEqual(batch)
  })

  it('preserves item order and count', () => {
    savePendingBatch(makeBatch())
    const loaded = loadPendingBatch()
    expect(loaded?.items).toHaveLength(2)
    expect(loaded?.items[0].word).toBe('serendipity')
    expect(loaded?.items[1].word).toBe('ephemeral')
  })

  it('IT Topic ID を batch preview handoff 用に保持する', () => {
    const batch = makeBatch({ formType: FormType.IT, topicIds: ['topic-1', 'topic-2'] })
    savePendingBatch(batch)
    expect(loadPendingBatch()?.topicIds).toEqual(['topic-1', 'topic-2'])
  })

  it('loadPendingBatch returns null when empty', () => {
    expect(loadPendingBatch()).toBeNull()
  })

  it('clearPendingBatch removes data', () => {
    savePendingBatch(makeBatch())
    clearPendingBatch()
    expect(loadPendingBatch()).toBeNull()
  })

  it('isPendingBatchStale false for fresh, true for old', () => {
    expect(isPendingBatchStale(makeBatch())).toBe(false)
    const old = makeBatch({ savedAt: new Date(Date.now() - 31 * 60 * 1000).toISOString() })
    expect(isPendingBatchStale(old)).toBe(true)
  })
})
