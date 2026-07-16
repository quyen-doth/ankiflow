import { randomBytes } from 'crypto'

const LINE_LINK_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const LINE_LINK_CODE_REGEX = /^ANKI-[A-HJ-NP-Z2-9]{6}$/

/** LINE 連携用の短期コードを生成する。紛らわしい I/O/0/1 は使用しない。 */
export function generateLineLinkCode(): string {
  const bytes = randomBytes(6)
  const suffix = Array.from(bytes, (byte) =>
    LINE_LINK_CODE_ALPHABET[byte % LINE_LINK_CODE_ALPHABET.length],
  ).join('')
  return `ANKI-${suffix}`
}

export function normalizeLineLinkCode(value: string): string {
  return value.trim().toUpperCase()
}
