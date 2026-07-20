export const VERIFY_PREFIX = 'data-verify-'

/**
 * 検証用コメント。
 * 検証用コメント。
 */
export function verifyAttrs(
  attrs: Record<string, string | number | boolean | null | undefined>
): Record<string, string> {
  if (process.env.NODE_ENV === 'production') return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) continue
    // 検証用コメント。
    // "React does not recognize the prop" trong dev
    out[`${VERIFY_PREFIX}${key.toLowerCase()}`] = String(value)
  }
  return out
}

/**
 * 検証用コメント。
 * 検証用コメント。
 */
export function readContract(root: HTMLElement): Record<string, string> {
  const el = root.hasAttribute(`${VERIFY_PREFIX}unit`)
    ? root
    : root.querySelector<HTMLElement>(`[${VERIFY_PREFIX}unit]`)
  if (!el) return {}
  const contract: Record<string, string> = {}
  for (const attr of Array.from(el.attributes)) {
    if (attr.name.startsWith(VERIFY_PREFIX)) {
      contract[attr.name.slice(VERIFY_PREFIX.length)] = attr.value
    }
  }
  return contract
}
