import { beforeEach, describe, expect, it } from 'vitest'
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
    generatedContent: { word: 'serendipity', meaning_vi: 'sự tình cờ may mắn' },
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

  it('savePendingEntry → loadPendingEntry round-trip', () => {
    const entry = makeEntry()
    savePendingEntry(entry)
    expect(loadPendingEntry()).toEqual(entry)
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
    expect(isPendingEntryStale(makeEntry())).toBe(false)

    const thirtyOneMinutesAgo = new Date(Date.now() - 31 * 60 * 1000).toISOString()
    expect(isPendingEntryStale(makeEntry({ savedAt: thirtyOneMinutesAgo }))).toBe(true)

    // Biên 30 phút: đúng 30 phút chưa được tính là stale (điều kiện strict >)
    const exactlyThirty = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    expect(isPendingEntryStale(makeEntry({ savedAt: exactlyThirty }))).toBe(false)
  })
})
