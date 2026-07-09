import type { Entry } from '@/types'

function filterDue(entries: Entry[], now: Date): Entry[] {
  return entries.filter((e) => {
    const rs = e.review_state
    if (!rs) return true
    return new Date(rs.due_date) <= now
  })
}

function prioritize(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    const aRS = a.review_state
    const bRS = b.review_state
    if (!aRS && !bRS) return 0
    if (!aRS) return -1
    if (!bRS) return 1
    const aRelearn = aRS.queue === 'relearning' ? 0 : 1
    const bRelearn = bRS.queue === 'relearning' ? 0 : 1
    if (aRelearn !== bRelearn) return aRelearn - bRelearn
    if (bRS.lapses !== aRS.lapses) return bRS.lapses - aRS.lapses
    return aRS.ease_factor - bRS.ease_factor
  })
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Lọc entries đã due (`review_state.due_date <= now`, entry chưa có review_state coi như
 * due), ưu tiên relearning > lapses cao > ease thấp, rồi lấy ngẫu nhiên `count` phần tử
 * trong top 10 ưu tiên nhất. Dùng chung bởi `/api/notifications/send` và
 * `/api/cron/srs-push` — tránh copy-paste logic prioritize thêm 1 lần nữa (script cũ
 * `scripts/send-notifications.ts` đã copy-paste và bị lệch nhẹ so với bản gốc).
 */
export function pickDueForReview(entries: Entry[], count: number, now: Date = new Date()): Entry[] {
  const due = filterDue(entries, now)
  if (due.length === 0) return []
  const prioritized = prioritize(due)
  const top = prioritized.slice(0, Math.min(10, prioritized.length))
  return shuffle(top).slice(0, count)
}
