export const DEFAULT_LINE_WORDS_PER_NOTIFICATION = 5

/** 1 回の LINE 通知に含める単語数を、admin input の文字列から検証する。 */
export function parseLineWordsPerNotification(value: string): number | null {
  const normalized = value.trim()
  if (!/^\d+$/.test(normalized)) return null

  const parsed = Number(normalized)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 10 ? parsed : null
}
