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
 * due な entries を抽出し (`review_state.due_date <= now`、review_state 未設定は due 扱い)、
 * relearning > lapses 多 > ease 低 の順で優先度付けし、上位 10 件から `count` 件を
 * ランダムに選ぶ。`/api/notifications/send` と `/api/cron/srs-push` で共用 —
 * prioritize ロジックの copy-paste 再発を防ぐ (旧 `scripts/send-notifications.ts` は
 * copy-paste して本家と微妙にズレていた)。
 */
export function pickDueForReview(entries: Entry[], count: number, now: Date = new Date()): Entry[] {
  const due = filterDue(entries, now)
  if (due.length === 0) return []
  const prioritized = prioritize(due)
  const top = prioritized.slice(0, Math.min(10, prioritized.length))
  return shuffle(top).slice(0, count)
}
