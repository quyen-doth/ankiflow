import { describe, expect, it } from 'vitest'
import { parsePostbackData, applyRating } from '@/lib/srs/webhook-handler'
import { createDefaultReviewState } from '@/lib/srs/sm2'

describe('lib/srs/webhook-handler', () => {
  describe('parsePostbackData', () => {
    it('parses valid ankiflow postback data', () => {
      const result = parsePostbackData('ankiflow:action=srs_rate&entry_id=abc123&rating=good')
      expect(result).toEqual({
        action: 'srs_rate',
        entry_id: 'abc123',
        rating: 'good',
      })
    })

    it('returns null for non-ankiflow prefix', () => {
      expect(parsePostbackData('content-radar:action=something')).toBeNull()
    })

    it('returns null for missing fields', () => {
      expect(parsePostbackData('ankiflow:action=srs_rate&entry_id=abc123')).toBeNull()
      expect(parsePostbackData('ankiflow:action=srs_rate&rating=good')).toBeNull()
    })

    it('returns null for invalid rating', () => {
      expect(parsePostbackData('ankiflow:action=srs_rate&entry_id=abc&rating=invalid')).toBeNull()
    })

    it('returns null for wrong action', () => {
      expect(parsePostbackData('ankiflow:action=other&entry_id=abc&rating=good')).toBeNull()
    })

    it('parses all valid ratings', () => {
      for (const rating of ['again', 'hard', 'good', 'easy']) {
        const result = parsePostbackData(`ankiflow:action=srs_rate&entry_id=x&rating=${rating}`)
        expect(result?.rating).toBe(rating)
      }
    })
  })

  describe('applyRating', () => {
    const now = new Date('2026-06-27T10:00:00Z')

    it('creates default state when none exists', () => {
      const result = applyRating(undefined, 'good', now)
      expect(result.total_reviews).toBe(1)
      expect(result.last_rating).toBe('good')
    })

    it('applies rating to existing state', () => {
      const state = createDefaultReviewState(now.toISOString())
      const result = applyRating(state, 'easy', now)
      expect(result.queue).toBe('review')
      expect(result.interval_days).toBe(4)
    })

    it('tracks again as lapse when reviewing', () => {
      const state = {
        ...createDefaultReviewState(now.toISOString()),
        queue: 'review' as const,
        interval_days: 10,
        ease_factor: 2.5,
      }
      const result = applyRating(state, 'again', now)
      expect(result.lapses).toBe(1)
      expect(result.queue).toBe('relearning')
    })
  })
})
