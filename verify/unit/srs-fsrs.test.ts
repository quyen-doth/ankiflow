import { describe, expect, it } from 'vitest'
import { createDefaultReviewState, applyRating, calculateNextIntervals, isDue, masteryLevel } from '@/lib/srs/fsrs'

// Snapshot giá trị thật đo bằng ts-fsrs 5.4.1 (default params) — không đoán số, chạy thật rồi ghi lại.
const NOW = new Date('2026-06-27T10:00:00Z')

describe('lib/srs/fsrs', () => {
  describe('createDefaultReviewState', () => {
    it('creates a new state with default values + empty fsrs block', () => {
      const state = createDefaultReviewState(NOW.toISOString())
      expect(state.ease_factor).toBe(2.5)
      expect(state.interval_days).toBe(0)
      expect(state.queue).toBe('new')
      expect(state.source).toBe('heuristic')
      expect(state.fsrs).toEqual({
        stability: 0,
        difficulty: 0,
        state: 0,
        reps: 0,
        scheduled_days: 0,
        last_review: '',
      })
    })

    it('defaults dueDate to now when omitted', () => {
      const before = Date.now()
      const state = createDefaultReviewState()
      expect(Date.parse(state.due_date)).toBeGreaterThanOrEqual(before)
    })
  })

  describe('applyRating — source marking (SRS Phase 0 precedence, KHÔNG đổi)', () => {
    it('rating luôn đánh dấu source builtin', () => {
      const state = createDefaultReviewState(NOW.toISOString())
      const result = applyRating(state, 'good', NOW)
      expect(result.source).toBe('builtin')
    })

    it('không đụng synced_at (sync-srs sở hữu field này)', () => {
      const state = { ...createDefaultReviewState(NOW.toISOString()), synced_at: '2026-06-01T00:00:00.000Z' }
      const result = applyRating(state, 'good', NOW)
      expect(result.synced_at).toBe('2026-06-01T00:00:00.000Z')
    })
  })

  describe('applyRating — single rating (đối chiếu output thật của ts-fsrs)', () => {
    it('undefined state + good → tạo default rồi rate, learning phase', () => {
      const result = applyRating(undefined, 'good', NOW)
      expect(result.total_reviews).toBe(1)
      expect(result.last_rating).toBe('good')
      expect(result.queue).toBe('learning')
      expect(result.interval_days).toBe(0)
      expect(result.fsrs?.reps).toBe(1)
      expect(result.fsrs?.state).toBe(1) // State.Learning
    })

    it('default state + easy → graduate thẳng lên review, 8 ngày', () => {
      const state = createDefaultReviewState(NOW.toISOString())
      const result = applyRating(state, 'easy', NOW)
      expect(result.queue).toBe('review')
      expect(result.interval_days).toBe(8)
      expect(result.due_date).toBe('2026-07-05T10:00:00.000Z')
      expect(result.fsrs?.state).toBe(2) // State.Review
    })

    it('review state + again → về short-term, interval reset 0', () => {
      const state = {
        ...createDefaultReviewState(NOW.toISOString()),
        queue: 'review' as const,
        interval_days: 10,
        ease_factor: 2.5,
      }
      const result = applyRating(state, 'again', NOW)
      expect(result.interval_days).toBe(0)
      expect(result.fsrs?.difficulty).toBeGreaterThan(2.5)
    })
  })

  describe('applyRating — chuỗi rating (Again → Good → Good → Easy, snapshot đo thật)', () => {
    it('stability/difficulty/due_date tiến triển đúng hướng và graduate sau Easy', () => {
      let state = applyRating(undefined, 'again', NOW)
      expect(state.fsrs?.stability).toBeCloseTo(0.212, 3)
      expect(state.queue).toBe('learning')

      let t = new Date(state.due_date)
      state = applyRating(state, 'good', t)
      expect(state.fsrs?.stability).toBeCloseTo(0.2467, 3)
      expect(state.queue).toBe('learning')

      t = new Date(state.due_date)
      state = applyRating(state, 'good', t)
      expect(state.fsrs?.stability).toBeCloseTo(0.2842, 3)
      // difficulty giảm dần qua các lần rate tốt liên tiếp
      expect(state.fsrs!.difficulty).toBeLessThan(6.4133)

      t = new Date(state.due_date)
      state = applyRating(state, 'easy', t)
      expect(state.queue).toBe('review')
      expect(state.interval_days).toBe(1)
      expect(state.fsrs?.stability).toBeCloseTo(0.558, 2)
    })
  })

  describe('calculateNextIntervals', () => {
    it('trả 4 nhãn thời lượng cho state mới (đo thật)', () => {
      const state = createDefaultReviewState(NOW.toISOString())
      const intervals = calculateNextIntervals(state)
      expect(intervals).toEqual({ again: '1m', hard: '6m', good: '10m', easy: '8d' })
    })

    it('mọi giá trị đều là chuỗi non-empty cho state đã trưởng thành', () => {
      const state = applyRating(undefined, 'easy', NOW)
      const intervals = calculateNextIntervals(state)
      for (const v of Object.values(intervals)) {
        expect(typeof v).toBe('string')
        expect(v.length).toBeGreaterThan(0)
      }
    })
  })

  describe('isDue / masteryLevel — giữ nguyên logic (không phụ thuộc FSRS)', () => {
    it('isDue so due_date với now', () => {
      const state = createDefaultReviewState('2026-01-01T00:00:00Z')
      expect(isDue(state, new Date('2026-01-02T00:00:00Z'))).toBe(true)
      expect(isDue(state, new Date('2025-12-31T00:00:00Z'))).toBe(false)
    })

    it('masteryLevel phân loại theo queue/interval_days', () => {
      expect(masteryLevel(createDefaultReviewState(NOW.toISOString()))).toBe('new')
      const learning = { ...createDefaultReviewState(NOW.toISOString()), queue: 'learning' as const }
      expect(masteryLevel(learning)).toBe('learning')
      const young = { ...createDefaultReviewState(NOW.toISOString()), queue: 'review' as const, interval_days: 5 }
      expect(masteryLevel(young)).toBe('young')
      const mature = { ...createDefaultReviewState(NOW.toISOString()), queue: 'review' as const, interval_days: 30 }
      expect(masteryLevel(mature)).toBe('mature')
    })
  })
})
