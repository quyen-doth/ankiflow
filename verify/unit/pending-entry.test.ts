import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearPendingEntry,
  isPendingEntryStale,
  loadPendingEntry,
  savePendingEntry,
  type PendingEntry,
} from '@/lib/pendingEntry'
import { FormType, LanguageType } from '@/types'

function makeEntry(overrides: Partial<PendingEntry> = {}): PendingEntry {
  return {
    generatedContent: { word: 'serendipity', meaning_vi: '幸運な偶然' },
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

describe('lib/pendingEntry', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('savePendingEntry → loadPendingEntry round-trip', () => {
    const entry = makeEntry()
    savePendingEntry(entry)
    expect(loadPendingEntry()).toEqual(entry)
  })

  it('IT Topic ID を preview handoff 用に保持する', () => {
    const entry = makeEntry({ formType: FormType.IT, topicIds: ['topic-1', 'topic-2'] })
    savePendingEntry(entry)
    expect(loadPendingEntry()?.topicIds).toEqual(['topic-1', 'topic-2'])
  })

  it('データがない場合 loadPendingEntry は null を返す', () => {
    expect(loadPendingEntry()).toBeNull()
  })

  it('JSON が壊れている場合 loadPendingEntry は null を返す', () => {
    localStorage.setItem('ankiflow_pending_result', '{broken')
    expect(loadPendingEntry()).toBeNull()
  })

  it('clearPendingEntry はデータを削除する', () => {
    savePendingEntry(makeEntry())
    clearPendingEntry()
    expect(loadPendingEntry()).toBeNull()
  })

  it('isPendingEntryStale: 保存直後は false、30 分超過で true', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-19T00:00:00.000Z'))

    expect(isPendingEntryStale(makeEntry())).toBe(false)

    const thirtyOneMinutesAgo = new Date(Date.now() - 31 * 60 * 1000).toISOString()
    expect(isPendingEntryStale(makeEntry({ savedAt: thirtyOneMinutesAgo }))).toBe(true)

    // 30 分ちょうどは stale と判定しない（strict > 条件）
    const exactlyThirty = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    expect(isPendingEntryStale(makeEntry({ savedAt: exactlyThirty }))).toBe(false)
  })
})
