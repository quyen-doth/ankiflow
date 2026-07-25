export interface ParsedMediaDataUrl {
  subtype: string
  base64: string
}

function parseMediaDataUrl(
  value: string | null | undefined,
  expectedKind: 'audio' | 'image',
): ParsedMediaDataUrl | null {
  if (!value) return null
  const match = value.match(
    /^data:(audio|image)\/([a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/]+={0,2})$/,
  )
  if (!match || match[1] !== expectedKind) return null

  const base64 = match[3]
  // Base64 は 4 文字単位。padding なしは許容するが、剰余 1 は常に不正。
  if (base64.length % 4 === 1) return null
  if (base64.includes('=') && base64.length % 4 !== 0) return null
  return { subtype: match[2], base64 }
}

export function parseAudioDataUrl(value: string | null | undefined): ParsedMediaDataUrl | null {
  return parseMediaDataUrl(value, 'audio')
}

export function parseImageDataUrl(value: string | null | undefined): ParsedMediaDataUrl | null {
  return parseMediaDataUrl(value, 'image')
}
