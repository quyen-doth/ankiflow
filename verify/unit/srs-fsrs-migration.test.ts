import { describe, expect, it } from 'vitest'
import { applyRating } from '@/lib/srs/fsrs'
import type { ReviewState } from '@/types'

// fsrs blockを持たない旧SM-2 entryからのlazy migrationを再現する。
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
    // fsrsを意図的に省き、旧entryのshapeを保つ。
  }
}

const NOW = new Date('2026-06-27T10:00:00Z')

describe('検証対象', () => {
  it('検証ケース', () => {
    const state = legacyState()
    expect(state.fsrs).toBeUndefined()

    const result = applyRating(state, 'good', NOW)

    expect(result.fsrs).toBeDefined()
    expect(result.fsrs?.state).toBe(2) // 旧intervalがあるcardはReviewとして移行する。
    expect(result.fsrs?.reps).toBe(6) // 旧review回数を失わず今回分だけ加算する。
  })

  it('検証ケース', () => {
    const state = legacyState()
    const result = applyRating(state, 'good', NOW)

    // legacy mirrorと新fsrs blockが分岐しないことを検証する。
    expect(result.interval_days).toBe(result.fsrs?.scheduled_days)
    expect(result.total_reviews).toBe(result.fsrs?.reps)
    expect(result.due_date).toBeTruthy()
    expect(result.source).toBe('builtin')
  })

  it('検証ケース', () => {
    const state = legacyState({ interval_days: 0, queue: 'new', total_reviews: 0, last_reviewed_at: '' })
    const result = applyRating(state, 'good', NOW)
    // 未graduateの旧cardはmigration後もlearningから始まる。
    expect(result.queue).toBe('learning')
  })

  it('検証ケース', () => {
    const state = legacyState({ source: 'anki_sync', ease_factor: 1.8, interval_days: 45, lapses: 3 })
    const result = applyRating(state, 'hard', NOW)
    expect(result.source).toBe('builtin')
    expect(result.fsrs).toBeDefined()
    // 低easeから高difficultyへ変換しても有限値を維持する。
    expect(Number.isFinite(result.fsrs?.difficulty)).toBe(true)
    expect(Number.isFinite(result.fsrs?.stability)).toBe(true)
  })

  it('検証ケース', () => {
    const state = legacyState({ lapses: 7 })
    const result = applyRating(state, 'hard', NOW) // hardでは旧lapsesを増減させない。
    expect(result.lapses).toBe(7)
  })
})
