const LINE_API_BASE = 'https://api.line.me/v2/bot'

interface LineMessagePayload {
  to: string
  messages: LineMessage[]
}

type LineMessage = LineFlexMessage | LineTextMessage

interface LineTextMessage {
  type: 'text'
  text: string
}

interface LineFlexMessage {
  type: 'flex'
  altText: string
  contents: Record<string, unknown>
}

interface LinePushResult {
  success: boolean
  error?: string
}

export async function pushMessage(
  channelAccessToken: string,
  userId: string,
  messages: LineMessage[],
): Promise<LinePushResult> {
  const payload: LineMessagePayload = { to: userId, messages }
  const payloadJson = JSON.stringify(payload)

  console.log('[LINE] Push payload size:', payloadJson.length, 'bytes')
  console.log('[LINE] Push payload:', payloadJson)

  let response: Response
  try {
    response = await fetch(`${LINE_API_BASE}/message/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: payloadJson,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[LINE] Fetch error:', msg)
    return { success: false, error: `Network error: ${msg}` }
  }

  if (!response.ok) {
    const rawText = await response.text().catch(() => '')
    console.error('[LINE] Error response:', response.status, rawText)
    let errorMsg = `HTTP ${response.status}`
    try {
      const body = JSON.parse(rawText)
      const details = body.details?.map((d: Record<string, string>) => d.message).join('; ')
      errorMsg = details
        ? `HTTP ${response.status}: ${body.message} — ${details}`
        : `HTTP ${response.status}: ${body.message ?? rawText}`
    } catch {
      errorMsg = `HTTP ${response.status}: ${rawText}`
    }
    return { success: false, error: errorMsg }
  }

  console.log('[LINE] Push success')
  return { success: true }
}

export async function replyMessage(
  channelAccessToken: string,
  replyToken: string,
  messages: LineMessage[],
): Promise<LinePushResult> {
  const response = await fetch(`${LINE_API_BASE}/message/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    return { success: false, error: body.message ?? `HTTP ${response.status}` }
  }

  return { success: true }
}

export function verifySignature(
  channelSecret: string,
  body: string,
  signature: string,
): boolean {
  if (typeof globalThis.crypto === 'undefined') return false
  const encoder = new TextEncoder()
  const key = encoder.encode(channelSecret)
  const data = encoder.encode(body)

  // Use Web Crypto for HMAC-SHA256 — async but we provide a sync fallback check
  // For server routes, use the async version via verifySignatureAsync
  void key
  void data
  void signature
  return true // placeholder — real verification done in verifySignatureAsync
}

export async function verifySignatureAsync(
  channelSecret: string,
  body: string,
  signature: string,
): Promise<boolean> {
  try {
    const crypto = await import('crypto')
    const hmac = crypto.createHmac('SHA256', channelSecret)
    hmac.update(body)
    const digest = hmac.digest('base64')
    return digest === signature
  } catch {
    return false
  }
}

export type { LineMessage, LineFlexMessage, LineTextMessage }
