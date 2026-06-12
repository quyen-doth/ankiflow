export const VERIFY_PREFIX = 'data-verify-'

/**
 * Sinh các thuộc tính `data-verify-*` để spread vào element gốc của component.
 * Trả về {} ở production để HTML build thật không chứa contract attrs.
 */
export function verifyAttrs(
  attrs: Record<string, string | number | boolean | null | undefined>
): Record<string, string> {
  if (process.env.NODE_ENV === 'production') return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) continue
    out[`${VERIFY_PREFIX}${key}`] = String(value)
  }
  return out
}

/**
 * Đọc contract từ element đầu tiên mang `data-verify-unit` bên trong root.
 * Trả về map không prefix, ví dụ { unit: 'Badge', variant: 'active' }.
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
