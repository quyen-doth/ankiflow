import { describe, expect, it } from 'vitest'
import {
  createDefaultReviewState,
  processRating,
  calculateNextIntervals,
  isDue,
  masteryLevel,
} from '@/lib/srs/sm2'
import type { ReviewState } from '@/types'

const NOW = new Date('2026-06-27T08:00:00Z')
const TOMORROW = '2026-06-28T08:00:00Z'

function makeReviewState(overrides: Partial<ReviewState> = {}): ReviewState {
  return { ...createDefaultReviewState(NOW.toISOString()), ...overrides }
}

describe('lib/srs/sm2', () => {
  describe('createDefaultReviewState', () => {
    it('creates a new state with default SM-2 values', () => {
      const state = createDefaultReviewState('2026-06-28T00:00:00Z')
      expect(state.ease_factor).toBe(2.5)
      expect(state.interval_days).toBe(0)
      expect(state.queue).toBe('new')
      expect(state.learning_step).toBe(0)
      expect(state.lapses).toBe(0)
      expect(state.total_reviews).toBe(0)
      expect(state.source).toBe('heuristic')
    })
  })

  describe('processRating — source marking (SRS Phase 0 precedence)', () => {
    it('rating luôn đánh dấu source builtin — kể cả khi state đến từ anki_sync', () => {
      const state = makeReviewState({ queue: 'review', interval_days: 5, source: 'anki_sync' })
      const result = processRating(state, 'good', NOW)
      expect(result.source).toBe('builtin')
    })
  })

  describe('processRating — new/learning cards', () => {
    it('again resets to step 0 with 1m delay', () => {
      const state = makeReviewState({ queue: 'new' })
      const result = processRating(state, 'again', NOW)
      expect(result.queue).toBe('learning')
      expect(result.learning_step).toBe(0)
      expect(result.total_reviews).toBe(1)
      const dueDate = new Date(result.due_date)
      expect(dueDate.getTime() - NOW.getTime()).toBe(60_000)
    })

    it('hard stays at current step', () => {
      const state = makeReviewState({ queue: 'learning', learning_step: 0 })
      const result = processRating(state, 'hard', NOW)
      expect(result.learning_step).toBe(0)
      const dueDate = new Date(result.due_date)
      expect(dueDate.getTime() - NOW.getTime()).toBe(60_000)
    })

    it('good advances to next learning step', () => {
      const state = makeReviewState({ queue: 'learning', learning_step: 0 })
      const result = processRating(state, 'good', NOW)
      expect(result.learning_step).toBe(1)
      const dueDate = new Date(result.due_date)
      expect(dueDate.getTime() - NOW.getTime()).toBe(10 * 60_000)
    })

    it('good on last step graduates to review', () => {
      const state = makeReviewState({ queue: 'learning', learning_step: 1 })
      const result = processRating(state, 'good', NOW)
      expect(result.queue).toBe('review')
      expect(result.interval_days).toBe(1)
      expect(result.learning_step).toBe(0)
    })

    it('easy immediately graduates with 4-day interval', () => {
      const state = makeReviewState({ queue: 'new' })
      const result = processRating(state, 'easy', NOW)
      expect(result.queue).toBe('review')
      expect(result.interval_days).toBe(4)
    })
  })

  describe('processRating — review cards', () => {
    const reviewState = makeReviewState({
      queue: 'review',
      interval_days: 10,
      ease_factor: 2.5,
    })

    it('again increases lapses, enters relearning', () => {
      const result = processRating(reviewState, 'again', NOW)
      expect(result.queue).toBe('relearning')
      expect(result.lapses).toBe(1)
      expect(result.ease_factor).toBe(2.3)
      expect(result.interval_days).toBe(1)
    })

    it('hard decreases ease, increases interval by 1.2x', () => {
      const result = processRating(reviewState, 'hard', NOW)
      expect(result.ease_factor).toBe(2.35)
      expect(result.interval_days).toBe(12)
      expect(result.queue).toBe('review')
    })

    it('good keeps ease, multiplies interval by ease', () => {
      const result = processRating(reviewState, 'good', NOW)
      expect(result.ease_factor).toBe(2.5)
      expect(result.interval_days).toBe(25)
    })

    it('easy increases ease, multiplies interval by ease*1.3', () => {
      const result = processRating(reviewState, 'easy', NOW)
      expect(result.ease_factor).toBe(2.65)
      expect(result.interval_days).toBe(33)
    })

    it('interval always increases by at least 1 day', () => {
      const shortState = makeReviewState({
        queue: 'review',
        interval_days: 1,
        ease_factor: 1.3,
      })
      const result = processRating(shortState, 'hard', NOW)
      expect(result.interval_days).toBeGreaterThan(1)
    })
  })

  describe('processRating — ease_factor clamped at 1.3', () => {
    it('does not go below 1.3 after multiple agains', () => {
      let state = makeReviewState({ queue: 'review', interval_days: 10, ease_factor: 1.5 })

      state = processRating(state, 'again', NOW)
      expect(state.ease_factor).toBe(1.3)

      state = { ...state, queue: 'review' as const, interval_days: 10 }
      state = processRating(state, 'again', NOW)
      expect(state.ease_factor).toBe(1.3)
    })

    it('does not go below 1.3 with hard', () => {
      const state = makeReviewState({ queue: 'review', interval_days: 5, ease_factor: 1.35 })
      const result = processRating(state, 'hard', NOW)
      expect(result.ease_factor).toBe(1.3)
    })
  })

  describe('processRating — relearning cards', () => {
    it('again resets to step 0 with 10m delay', () => {
      const state = makeReviewState({ queue: 'relearning', learning_step: 0 })
      const result = processRating(state, 'again', NOW)
      expect(result.queue).toBe('relearning')
      expect(result.learning_step).toBe(0)
      const dueDate = new Date(result.due_date)
      expect(dueDate.getTime() - NOW.getTime()).toBe(10 * 60_000)
    })

    it('good graduates back to review (single relearning step)', () => {
      const state = makeReviewState({
        queue: 'relearning',
        learning_step: 0,
        ease_factor: 2.3,
        interval_days: 1,
      })
      const result = processRating(state, 'good', NOW)
      expect(result.queue).toBe('review')
      expect(result.interval_days).toBe(1)
    })
  })

  describe('calculateNextIntervals', () => {
    it('returns formatted intervals for a review card', () => {
      const state = makeReviewState({
        queue: 'review',
        interval_days: 10,
        ease_factor: 2.5,
      })
      const intervals = calculateNextIntervals(state)
      expect(intervals.again).toBe('10m')
      expect(intervals.hard).toBe('12d')
      expect(intervals.good).toBe('25d')
      expect(intervals.easy).toBe('1.1mo')
    })

    it('returns formatted intervals for a new card', () => {
      const state = makeReviewState({ queue: 'new', learning_step: 0 })
      const intervals = calculateNextIntervals(state)
      expect(intervals.again).toBe('1m')
      expect(intervals.hard).toBe('1m')
      expect(intervals.good).toBe('10m')
      expect(intervals.easy).toBe('4d')
    })

    it('returns graduating interval on last learning step', () => {
      const state = makeReviewState({ queue: 'learning', learning_step: 1 })
      const intervals = calculateNextIntervals(state)
      expect(intervals.good).toBe('1d')
    })

    it('formats months and years for long intervals', () => {
      const state = makeReviewState({
        queue: 'review',
        interval_days: 100,
        ease_factor: 2.5,
      })
      const intervals = calculateNextIntervals(state)
      expect(intervals.good).toBe('8.3mo')
    })
  })

  describe('isDue', () => {
    it('returns true when due_date is in the past', () => {
      const state = makeReviewState({ due_date: '2026-06-26T00:00:00Z' })
      expect(isDue(state, NOW)).toBe(true)
    })

    it('returns false when due_date is in the future', () => {
      const state = makeReviewState({ due_date: '2026-06-28T00:00:00Z' })
      expect(isDue(state, NOW)).toBe(false)
    })

    it('returns true when due_date equals now', () => {
      const state = makeReviewState({ due_date: NOW.toISOString() })
      expect(isDue(state, NOW)).toBe(true)
    })
  })

  describe('masteryLevel', () => {
    it('returns new for new cards', () => {
      expect(masteryLevel(makeReviewState({ queue: 'new' }))).toBe('new')
    })

    it('returns learning for learning/relearning', () => {
      expect(masteryLevel(makeReviewState({ queue: 'learning' }))).toBe('learning')
      expect(masteryLevel(makeReviewState({ queue: 'relearning' }))).toBe('learning')
    })

    it('returns young for review cards with interval < 21', () => {
      expect(masteryLevel(makeReviewState({ queue: 'review', interval_days: 10 }))).toBe('young')
    })

    it('returns mature for review cards with interval >= 21', () => {
      expect(masteryLevel(makeReviewState({ queue: 'review', interval_days: 21 }))).toBe('mature')
      expect(masteryLevel(makeReviewState({ queue: 'review', interval_days: 60 }))).toBe('mature')
    })
  })

  describe('processRating — tracks total_reviews and last_reviewed_at', () => {
    it('increments total_reviews on each rating', () => {
      let state = makeReviewState({ queue: 'new', total_reviews: 0 })
      state = processRating(state, 'good', NOW)
      expect(state.total_reviews).toBe(1)
      state = processRating(state, 'good', NOW)
      expect(state.total_reviews).toBe(2)
    })

    it('sets last_reviewed_at to now', () => {
      const state = makeReviewState({ queue: 'new' })
      const result = processRating(state, 'good', NOW)
      expect(result.last_reviewed_at).toBe(NOW.toISOString())
    })
  })
})
