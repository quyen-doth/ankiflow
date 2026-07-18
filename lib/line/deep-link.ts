function normalizeBotId(botId: string | undefined): string | null {
  const trimmed = botId?.trim()
  if (!trimmed) return null
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`
}

/** Prefer the configured add-friend URL, then fall back to LINE's official profile URL. */
export function buildLineAddFriendUrl(
  addFriendUrl?: string,
  botId?: string,
): string | null {
  const configuredUrl = addFriendUrl?.trim()
  if (configuredUrl) return configuredUrl

  const normalizedBotId = normalizeBotId(botId)
  if (!normalizedBotId) return null

  return `https://line.me/R/ti/p/${encodeURIComponent(normalizedBotId)}`
}

/** Open an Official Account chat and pre-fill the one-time linking code. */
export function buildLineSendCodeUrl(
  botId: string | undefined,
  code: string,
): string | null {
  const normalizedBotId = normalizeBotId(botId)
  const normalizedCode = code.trim()
  if (!normalizedBotId || !normalizedCode) return null

  return `https://line.me/R/oaMessage/${encodeURIComponent(normalizedBotId)}/?${encodeURIComponent(normalizedCode)}`
}
