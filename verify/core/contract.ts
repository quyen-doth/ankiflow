export const VERIFY_PREFIX = 'data-verify-'

/** 本番HTMLへ検証属性を残さないため、開発時だけDOM contractを公開する。 */
export function verifyAttrs(
  attrs: Record<string, string | number | boolean | null | undefined>
): Record<string, string> {
  if (process.env.NODE_ENV === 'production') return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) continue
    // Reactの未知prop警告を避けるため、HTML属性名を小文字へ正規化する。
    out[`${VERIFY_PREFIX}${key.toLowerCase()}`] = String(value)
  }
  return out
}

/** ラッパーの有無に左右されず同じcontractを読めるよう、root自身を先に探索する。 */
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
