import { describe, expect, it } from 'vitest'
import { parseLineWordsPerNotification } from '@/lib/notifications/config'

describe('parseLineWordsPerNotification', () => {
  it.each([
    ['1', 1],
    ['5', 5],
    ['10', 10],
    [' 7 ', 7],
  ])('%j を %i として受け入れる', (input, expected) => {
    expect(parseLineWordsPerNotification(input)).toBe(expected)
  })

  it.each(['', '0', '11', '1.5', 'abc'])('%j を拒否する', (input) => {
    expect(parseLineWordsPerNotification(input)).toBeNull()
  })
})
