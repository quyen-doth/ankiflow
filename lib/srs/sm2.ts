import type { ReviewState, SRSRating, SRSQueue } from '@/types'

const MIN_EASE = 1.3
const LEARNING_STEPS_MINUTES = [1, 10]
const RELEARNING_STEPS_MINUTES = [10]
const GRADUATING_INTERVAL = 1
const EASY_GRADUATING_INTERVAL = 4

export function createDefaultReviewState(dueDate: string): ReviewState {
  return {
    ease_factor: 2.5,
    interval_days: 0,
    due_date: dueDate,
    lapses: 0,
    total_reviews: 0,
    last_reviewed_at: '',
    last_rating: 'good',
    queue: 'new',
    learning_step: 0,
    source: 'heuristic',
    synced_at: '',
  }
}

export function processRating(state: ReviewState, rating: SRSRating, now: Date = new Date()): ReviewState {
  const nowISO = now.toISOString()
  const base: ReviewState = {
    ...state,
    total_reviews: state.total_reviews + 1,
    last_reviewed_at: nowISO,
    last_rating: rating,
    // Rating nội bộ luôn đánh dấu builtin — nếu giữ nguyên source cũ (vd 'anki_sync')
    // thì precedence guard trong sync-srs không nhận ra state đã được rate qua LINE.
    source: 'builtin',
  }

  if (state.queue === 'new' || state.queue === 'learning') {
    return processLearningRating(base, rating, now, LEARNING_STEPS_MINUTES)
  }

  if (state.queue === 'relearning') {
    return processLearningRating(base, rating, now, RELEARNING_STEPS_MINUTES)
  }

  return processReviewRating(base, rating, now)
}

function processLearningRating(
  state: ReviewState,
  rating: SRSRating,
  now: Date,
  steps: number[],
): ReviewState {
  switch (rating) {
    case 'again': {
      return {
        ...state,
        learning_step: 0,
        queue: state.queue === 'relearning' ? 'relearning' : 'learning',
        due_date: addMinutes(now, steps[0]).toISOString(),
        interval_days: 0,
      }
    }

    case 'hard': {
      const stepMinutes = steps[state.learning_step] ?? steps[steps.length - 1]
      return {
        ...state,
        due_date: addMinutes(now, stepMinutes).toISOString(),
        interval_days: 0,
      }
    }

    case 'good': {
      const nextStep = state.learning_step + 1
      if (nextStep >= steps.length) {
        return graduate(state, now, GRADUATING_INTERVAL)
      }
      return {
        ...state,
        learning_step: nextStep,
        due_date: addMinutes(now, steps[nextStep]).toISOString(),
        interval_days: 0,
      }
    }

    case 'easy': {
      return graduate(state, now, EASY_GRADUATING_INTERVAL)
    }
  }
}

function graduate(state: ReviewState, now: Date, intervalDays: number): ReviewState {
  return {
    ...state,
    queue: 'review',
    learning_step: 0,
    interval_days: intervalDays,
    due_date: addDays(now, intervalDays).toISOString(),
    ease_factor: state.queue === 'new' ? 2.5 : state.ease_factor,
  }
}

function processReviewRating(state: ReviewState, rating: SRSRating, now: Date): ReviewState {
  switch (rating) {
    case 'again': {
      const newEase = clampEase(state.ease_factor - 0.2)
      return {
        ...state,
        ease_factor: newEase,
        lapses: state.lapses + 1,
        queue: 'relearning',
        learning_step: 0,
        interval_days: 1,
        due_date: addMinutes(now, RELEARNING_STEPS_MINUTES[0]).toISOString(),
      }
    }

    case 'hard': {
      const newEase = clampEase(state.ease_factor - 0.15)
      const newInterval = Math.max(Math.round(state.interval_days * 1.2), state.interval_days + 1)
      return {
        ...state,
        ease_factor: newEase,
        interval_days: newInterval,
        due_date: addDays(now, newInterval).toISOString(),
      }
    }

    case 'good': {
      const newInterval = Math.max(Math.round(state.interval_days * state.ease_factor), state.interval_days + 1)
      return {
        ...state,
        interval_days: newInterval,
        due_date: addDays(now, newInterval).toISOString(),
      }
    }

    case 'easy': {
      const newEase = clampEase(state.ease_factor + 0.15)
      const newInterval = Math.max(Math.round(state.interval_days * state.ease_factor * 1.3), state.interval_days + 1)
      return {
        ...state,
        ease_factor: newEase,
        interval_days: newInterval,
        due_date: addDays(now, newInterval).toISOString(),
      }
    }
  }
}

function clampEase(ease: number): number {
  return Math.round(Math.max(MIN_EASE, ease) * 100) / 100
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function calculateNextIntervals(state: ReviewState): Record<SRSRating, string> {
  if (state.queue === 'new' || state.queue === 'learning' || state.queue === 'relearning') {
    const steps = state.queue === 'relearning' ? RELEARNING_STEPS_MINUTES : LEARNING_STEPS_MINUTES
    const currentStep = steps[state.learning_step] ?? steps[steps.length - 1]
    const nextStep = steps[state.learning_step + 1]

    return {
      again: formatInterval(0, steps[0]),
      hard: formatInterval(0, currentStep),
      good: nextStep !== undefined ? formatInterval(0, nextStep) : formatInterval(GRADUATING_INTERVAL, 0),
      easy: formatInterval(EASY_GRADUATING_INTERVAL, 0),
    }
  }

  const hardInterval = Math.max(Math.round(state.interval_days * 1.2), state.interval_days + 1)
  const goodInterval = Math.max(Math.round(state.interval_days * state.ease_factor), state.interval_days + 1)
  const easyEase = Math.max(MIN_EASE, state.ease_factor + 0.15)
  const easyInterval = Math.max(Math.round(state.interval_days * easyEase * 1.3), state.interval_days + 1)

  return {
    again: formatInterval(0, RELEARNING_STEPS_MINUTES[0]),
    hard: formatInterval(hardInterval, 0),
    good: formatInterval(goodInterval, 0),
    easy: formatInterval(easyInterval, 0),
  }
}

function formatInterval(days: number, minutes: number): string {
  if (days > 0) {
    if (days >= 365) return `${Math.round(days / 365 * 10) / 10}y`
    if (days >= 30) return `${Math.round(days / 30 * 10) / 10}mo`
    return `${days}d`
  }
  if (minutes >= 60) return `${Math.round(minutes / 60 * 10) / 10}h`
  return `${minutes}m`
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

export type { SRSQueue as Queue }
