import { describe, expect, it } from 'vitest'
import { discardBatchEntry } from '@/lib/preview/discardBatchEntry'

const ENTRIES = ['first', 'second', 'third']

describe('discardBatchEntry', () => {
  it('中央の entry を除外し、同じ index の次の entry を選択する', () => {
    expect(discardBatchEntry(ENTRIES, 1)).toEqual({
      entries: ['first', 'third'],
      nextActiveIndex: 1,
    })
  })

  it('先頭の entry を除外し、新しい先頭を選択する', () => {
    expect(discardBatchEntry(ENTRIES, 0)).toEqual({
      entries: ['second', 'third'],
      nextActiveIndex: 0,
    })
  })

  it('末尾の entry を除外し、一つ前の index に戻る', () => {
    expect(discardBatchEntry(ENTRIES, 2)).toEqual({
      entries: ['first', 'second'],
      nextActiveIndex: 1,
    })
  })

  it('最後の一件を除外すると空配列と index 0 を返す', () => {
    expect(discardBatchEntry(['only'], 0)).toEqual({
      entries: [],
      nextActiveIndex: 0,
    })
  })

  it.each([-1, ENTRIES.length])('範囲外の index %i では元の配列を変更しない', (index) => {
    const result = discardBatchEntry(ENTRIES, index)
    expect(result.entries).toBe(ENTRIES)
  })
})
