import { describe, expect, it } from 'vitest'
import { applyRating } from '@/lib/srs/fsrs'
import type { ReviewState } from '@/types'

// Entry SM-2 cũ (Phase 0, trước khi có FSRS) — không có block `fsrs`.
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
    // fsrs KHÔNG set — mô phỏng entry cũ hoặc vừa sync từ Anki
  }
}

const NOW = new Date('2026-06-27T10:00:00Z')

describe('lib/srs/fsrs — lazy migration từ SM-2 cũ', () => {
  it('entry chưa có fsrs block → applyRating tạo block fsrs mới', () => {
    const state = legacyState()
    expect(state.fsrs).toBeUndefined()

    const result = applyRating(state, 'good', NOW)

    expect(result.fsrs).toBeDefined()
    expect(result.fsrs?.state).toBe(2) // State.Review — vì interval_days cũ > 0
    expect(result.fsrs?.reps).toBe(6) // total_reviews cũ (5) + 1
  })

  it('field mirror cũ vẫn consistent sau migrate (interval_days/total_reviews theo FSRS mới)', () => {
    const state = legacyState()
    const result = applyRating(state, 'good', NOW)

    // Mirror phải khớp 1:1 với block fsrs vừa tính — không lệch giữa 2 nơi.
    expect(result.interval_days).toBe(result.fsrs?.scheduled_days)
    expect(result.total_reviews).toBe(result.fsrs?.reps)
    expect(result.due_date).toBeTruthy()
    expect(result.source).toBe('builtin')
  })

  it('entry với interval_days=0 (chưa từng graduate) → migrate thành State.New', () => {
    const state = legacyState({ interval_days: 0, queue: 'new', total_reviews: 0, last_reviewed_at: '' })
    const result = applyRating(state, 'good', NOW)
    // Trước rate, card migrate là New (interval_days=0) — sau 1 lần 'good' sẽ vào learning.
    expect(result.queue).toBe('learning')
  })

  it('entry vừa sync từ Anki (source anki_sync, không có fsrs) → rate qua LINE vẫn migrate đúng', () => {
    const state = legacyState({ source: 'anki_sync', ease_factor: 1.8, interval_days: 45, lapses: 3 })
    const result = applyRating(state, 'hard', NOW)
    expect(result.source).toBe('builtin')
    expect(result.fsrs).toBeDefined()
    // ease thấp (1.8) → difficulty migrate cao → vẫn tính ra kết quả hợp lệ, không NaN/undefined
    expect(Number.isFinite(result.fsrs?.difficulty)).toBe(true)
    expect(Number.isFinite(result.fsrs?.stability)).toBe(true)
  })

  it('không mất lapses cũ khi migrate (lapses đọc từ legacy field, không phải fsrs block)', () => {
    const state = legacyState({ lapses: 7 })
    const result = applyRating(state, 'hard', NOW) // 'hard' không tăng lapses
    expect(result.lapses).toBe(7)
  })
})
