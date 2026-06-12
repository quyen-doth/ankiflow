import type { FetchRule } from '@/verify/core/types'

/**
 * Thay globalThis.fetch bằng matcher theo FetchRule[].
 * URL không khớp rule nào → 501 (không bao giờ chạm network thật).
 * Trả về hàm restore.
 */
export function installMockFetch(rules: FetchRule[]): () => void {
  const original = globalThis.fetch

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url

    const rule = rules.find(r =>
      typeof r.match === 'string' ? url.includes(r.match) : r.match.test(url)
    )

    if (!rule) {
      return new Response(
        JSON.stringify({ error: `verify mock-fetch: unmatched URL ${url}` }),
        { status: 501, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { status = 200, json = {}, delayMs, reject } = rule.response
    if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs))
    if (reject) throw new TypeError('verify mock-fetch: simulated network failure')

    return new Response(JSON.stringify(json), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch

  return () => {
    globalThis.fetch = original
  }
}
