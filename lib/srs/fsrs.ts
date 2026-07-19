import { fsrs, createEmptyCard, dateDiffInDays, Rating, State, type Card, type Grade } from 'ts-fsrs'
import type { ReviewState, SRSRating, SRSQueue } from '@/types'

// FSRS (Free Spaced Repetition Scheduler) — 旧 SM-2 実装の置き換え (Git 履歴参照)。
// public API (`createDefaultReviewState`, `applyRating`, `calculateNextIntervals`,
// `isDue`, `masteryLevel`) は維持し、既存 caller (webhook-handler.ts, flex-message.ts) の
// 変更を不要にする。旧 "mirror" field (ease_factor/interval_days/due_date/lapses/
// total_reviews/queue) は常に FSRS の結果から並行更新される — precedence guard
// (`sync-srs/route.ts`、`source`/`last_reviewed_at`/`synced_at` を参照) と
// revlog (`review_events`) は変更不要。

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

/** migrate 式 (difficultyFromEase) の逆関数 — mirror field `ease_factor` が旧 reader に
 * とって近似的な意味を持つためだけのもの (FSRS のアルゴリズム上の意味はない)。 */
function easeFromDifficulty(difficulty: number): number {
  return Math.round(((11 - difficulty) / 2.4) * 100) / 100
}

function difficultyFromEase(ease: number): number {
  return Math.min(10, Math.max(1, 11 - ease * 2.4))
}

/** ReviewState → FSRS Card 変換。`state.fsrs` があれば (FSRS で rate 済み) そのまま使用。
 * なければ (旧 SM-2 データ、または Anki sync 由来で `fsrs` block なし)
 * → mirror field から lazy migrate。書き戻しはしない (実際に applyRating した時のみ書く)。 */
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

  // Lazy migrate: 旧 SM-2 entry、または Anki から sync 直後 (fsrs block なし)。
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
    // 内部 rating は常に builtin をマーク — sync-srs の precedence guard はこの field で
    // LINE/内部 FSRS 経由の rate 済み state を識別する (guard のロジックは変更しない)。
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
