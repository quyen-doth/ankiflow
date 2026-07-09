import { fsrs, createEmptyCard, dateDiffInDays, Rating, State, type Card, type Grade } from 'ts-fsrs'
import type { ReviewState, SRSRating, SRSQueue } from '@/types'

// FSRS (Free Spaced Repetition Scheduler) — thay thế SM-2 (xem `sm2.ts.bak`).
// Giữ nguyên public API (`createDefaultReviewState`, `applyRating`, `calculateNextIntervals`,
// `isDue`, `masteryLevel`) để mọi caller hiện có (webhook-handler.ts, flex-message.ts) không
// cần sửa. Field "mirror" cũ (ease_factor/interval_days/due_date/lapses/total_reviews/queue)
// luôn được cập nhật song song từ kết quả FSRS — precedence guard (`sync-srs/route.ts`,
// đọc `source`/`last_reviewed_at`/`synced_at`) và revlog (`review_events`) không cần đổi gì.

const f = fsrs()

const RATING_TO_GRADE: Record<SRSRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
}

const FSRS_STATE_TO_QUEUE: Record<State, SRSQueue> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
}

/** Nghịch đảo công thức migrate (difficultyFromEase) — chỉ để field `ease_factor` mirror có ý
 * nghĩa gần đúng cho reader cũ (không có ý nghĩa thuật toán trong FSRS). */
function easeFromDifficulty(difficulty: number): number {
  return Math.round(((11 - difficulty) / 2.4) * 100) / 100
}

function difficultyFromEase(ease: number): number {
  return Math.min(10, Math.max(1, 11 - ease * 2.4))
}

/** Chuyển ReviewState → FSRS Card. Nếu đã có `state.fsrs` (đã từng rate qua FSRS) → dùng
 * trực tiếp. Nếu chưa (data SM-2 cũ, hoặc state đến từ Anki sync — không có block `fsrs`)
 * → lazy migrate từ field mirror, KHÔNG ghi lại (chỉ ghi khi thực sự applyRating). */
function toFsrsCard(state: ReviewState, now: Date): Card {
  const lastReview = state.fsrs?.last_review || state.last_reviewed_at || undefined
  const lastReviewDate = lastReview ? new Date(lastReview) : undefined
  const elapsedDays = lastReviewDate ? dateDiffInDays(lastReviewDate, now) : 0

  if (state.fsrs) {
    return {
      due: new Date(state.due_date),
      stability: state.fsrs.stability,
      difficulty: state.fsrs.difficulty,
      elapsed_days: elapsedDays,
      scheduled_days: state.fsrs.scheduled_days,
      learning_steps: 0,
      reps: state.fsrs.reps,
      lapses: state.lapses,
      state: state.fsrs.state as State,
      last_review: lastReviewDate,
    }
  }

  // Lazy migrate: entry SM-2 cũ hoặc vừa sync từ Anki (chưa có block fsrs).
  const stability = Math.max(state.interval_days, 0.5)
  const difficulty = difficultyFromEase(state.ease_factor)
  const fsrsState = state.interval_days > 0 ? State.Review : State.New
  return {
    due: new Date(state.due_date),
    stability,
    difficulty,
    elapsed_days: elapsedDays,
    scheduled_days: state.interval_days,
    learning_steps: 0,
    reps: state.total_reviews,
    lapses: state.lapses,
    state: fsrsState,
    last_review: lastReviewDate,
  }
}

function mergeFsrsResult(prev: ReviewState, updated: Card, rating: SRSRating, now: Date): ReviewState {
  return {
    ease_factor: easeFromDifficulty(updated.difficulty),
    interval_days: updated.scheduled_days,
    due_date: updated.due.toISOString(),
    lapses: updated.lapses,
    total_reviews: updated.reps,
    last_reviewed_at: now.toISOString(),
    last_rating: rating,
    queue: FSRS_STATE_TO_QUEUE[updated.state],
    learning_step: 0,
    // Rating nội bộ luôn đánh dấu builtin — precedence guard trong sync-srs dựa vào field
    // này để nhận biết state đã được rate qua LINE/FSRS nội bộ (KHÔNG đổi logic guard).
    source: 'builtin',
    synced_at: prev.synced_at,
    fsrs: {
      stability: updated.stability,
      difficulty: updated.difficulty,
      state: updated.state,
      reps: updated.reps,
      scheduled_days: updated.scheduled_days,
      last_review: now.toISOString(),
    },
  }
}

export function createDefaultReviewState(dueDate?: string): ReviewState {
  const due = dueDate ?? new Date().toISOString()
  const card = createEmptyCard(new Date(due))
  return {
    ease_factor: 2.5,
    interval_days: 0,
    due_date: due,
    lapses: 0,
    total_reviews: 0,
    last_reviewed_at: '',
    last_rating: 'good',
    queue: 'new',
    learning_step: 0,
    source: 'heuristic',
    synced_at: '',
    fsrs: {
      stability: card.stability,
      difficulty: card.difficulty,
      state: card.state,
      reps: card.reps,
      scheduled_days: card.scheduled_days,
      last_review: '',
    },
  }
}

export function applyRating(
  currentState: ReviewState | undefined,
  rating: SRSRating,
  now: Date = new Date(),
): ReviewState {
  const state = currentState ?? createDefaultReviewState(now.toISOString())
  const card = toFsrsCard(state, now)
  const grade = RATING_TO_GRADE[rating]
  const { card: updated } = f.next(card, now, grade)
  return mergeFsrsResult(state, updated, rating, now)
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, ms / 60_000)
  const days = totalMinutes / (60 * 24)
  if (days >= 1) {
    if (days >= 365) return `${Math.round((days / 365) * 10) / 10}y`
    if (days >= 30) return `${Math.round((days / 30) * 10) / 10}mo`
    return `${Math.round(days)}d`
  }
  if (totalMinutes >= 60) return `${Math.round((totalMinutes / 60) * 10) / 10}h`
  return `${Math.round(totalMinutes)}m`
}

export function calculateNextIntervals(state: ReviewState): Record<SRSRating, string> {
  const now = new Date()
  const card = toFsrsCard(state, now)
  const preview = f.repeat(card, now)
  const dueOf = (rating: SRSRating) => preview[RATING_TO_GRADE[rating]].card.due.getTime()

  return {
    again: formatDuration(dueOf('again') - now.getTime()),
    hard: formatDuration(dueOf('hard') - now.getTime()),
    good: formatDuration(dueOf('good') - now.getTime()),
    easy: formatDuration(dueOf('easy') - now.getTime()),
  }
}

export function isDue(state: ReviewState, now: Date = new Date()): boolean {
  return new Date(state.due_date) <= now
}

export function masteryLevel(state: ReviewState): 'new' | 'learning' | 'young' | 'mature' {
  if (state.queue === 'new') return 'new'
  if (state.queue === 'learning' || state.queue === 'relearning') return 'learning'
  if (state.interval_days >= 21) return 'mature'
  return 'young'
}
