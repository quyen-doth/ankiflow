import { describe, expect, it } from 'vitest'
import { applyRating } from '@/lib/srs/fsrs'
import type { ReviewState } from '@/types'

// 検証用コメント。
function legacyState(overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    ease_factor: 2.5,
    interval_days: 10,
    due_date: '2026-06-27T10:00:00.000Z',
    lapses: 0,
    total_reviews: 5,
    last_reviewed_at: '2026-06-20T10:00:00.000Z',
    last_rating: 'good',
    queue: 'review',
    learning_step: 0,
    source: 'anki_sync',
    synced_at: '2026-06-27T10:00:00.000Z',
    ...overrides,
    // 検証用コメント。
  }
}

const NOW = new Date('2026-06-27T10:00:00Z')

describe('検証対象', () => {
  it('検証ケース', () => {
    const state = legacyState()
    expect(state.fsrs).toBeUndefined()

    const result = applyRating(state, 'good', NOW)

    expect(result.fsrs).toBeDefined()
    expect(result.fsrs?.state).toBe(2) // 検証用コメント。
    expect(result.fsrs?.reps).toBe(6) // 検証用コメント。
  })

  it('検証ケース', () => {
    const state = legacyState()
    const result = applyRating(state, 'good', NOW)

    // 検証用コメント。
    expect(result.interval_days).toBe(result.fsrs?.scheduled_days)
    expect(result.total_reviews).toBe(result.fsrs?.reps)
    expect(result.due_date).toBeTruthy()
    expect(result.source).toBe('builtin')
  })

  it('検証ケース', () => {
    const state = legacyState({ interval_days: 0, queue: 'new', total_reviews: 0, last_reviewed_at: '' })
    const result = applyRating(state, 'good', NOW)
    // 検証用コメント。
    expect(result.queue).toBe('learning')
  })

  it('検証ケース', () => {
    const state = legacyState({ source: 'anki_sync', ease_factor: 1.8, interval_days: 45, lapses: 3 })
    const result = applyRating(state, 'hard', NOW)
    expect(result.source).toBe('builtin')
    expect(result.fsrs).toBeDefined()
    // 検証用コメント。
    expect(Number.isFinite(result.fsrs?.difficulty)).toBe(true)
    expect(Number.isFinite(result.fsrs?.stability)).toBe(true)
  })

  it('検証ケース', () => {
    const state = legacyState({ lapses: 7 })
    const result = applyRating(state, 'hard', NOW) // 検証用コメント。
    expect(result.lapses).toBe(7)
  })
})
