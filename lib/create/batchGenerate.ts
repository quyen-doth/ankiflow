/**
 * batchGenerate.ts
 * 1 回で複数のカードのコンテンツを生成し、1 つの blueprint + session を共有する。
 * 各 item (主要フィールド) は単一フローと同じ `blueprint.generate` を通るが、
 * rate-limit を避けるための concurrency 制限があり、onProgress で進捗を報告する。
 */

import { LanguageType } from '@/types'
import type { SessionState } from '@/lib/session'
import type { CardFormBlueprint } from '@/lib/create/formBlueprint'

/** batch generate 時に同時実行する request の最大数。 */
export const BATCH_CONCURRENCY = 3

/** 1 item の generate 結果 — 入力の順序を保持。 */
export interface BatchGenResult {
  item: string
  ok: boolean
  /** ok = true の場合の AI コンテンツ (partial Entry fields)。 */
  content?: Record<string, unknown>
  /** ok = false の場合のエラーメッセージ。 */
  error?: string
}

interface GenerateBatchOptions {
  /** 各カード完了後 (成功またはエラー) に呼ばれる。 */
  onProgress?: (done: number, total: number) => void
  /** 途中でのキャンセルを許可 — fetch に渡し、新しい item の取得を止める。 */
  signal?: AbortSignal
}

/** blueprint.generate (api または local) に基づいて 1 item のコンテンツを生成。 */
async function generateOne(
  blueprint: CardFormBlueprint,
  item: string,
  session: SessionState,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const primaryKey = blueprint.coreFields[0]?.key ?? 'word'
  const values: Record<string, string> = { [primaryKey]: item }

  if (blueprint.generate.mode === 'api') {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(blueprint.generate.payload(values, session)),
      signal,
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || 'Failed to call Claude API')
    }
    return (await res.json()).content
  }

  return blueprint.generate.content(values, session)
}

/**
 * item のリストに対して generate を実行。item の順序通りに結果の配列を返す。
 * 1 つの item のエラーは batch 全体を止めない — ok:false としてマークされる。
 */
export async function generateBatch(
  blueprint: CardFormBlueprint,
  items: string[],
  session: SessionState,
  options: GenerateBatchOptions = {},
): Promise<BatchGenResult[]> {
  const { onProgress, signal } = options

  // session を正規化: 言語 content type の場合、不足していれば English をデフォルトにする。
  const effectiveSession: SessionState = {
    ...session,
    language:
      blueprint.uiFormType === 'Language'
        ? (session.language as LanguageType) || LanguageType.ENGLISH
        : session.language,
  }

  const results: BatchGenResult[] = new Array(items.length)
  let done = 0
  let cursor = 0

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      if (signal?.aborted) return // キャンセル済みなら新しい item の取得を止める
      const index = cursor++
      const item = items[index]
      try {
        const content = await generateOne(blueprint, item, effectiveSession, signal)
        results[index] = { item, ok: true, content }
      } catch (err) {
        if (signal?.aborted || (err instanceof Error && err.name === 'AbortError')) return
        results[index] = {
          item,
          ok: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }
      } finally {
        if (!signal?.aborted) {
          done += 1
          onProgress?.(done, items.length)
        }
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(BATCH_CONCURRENCY, items.length) },
    () => worker(),
  )
  await Promise.all(workers)

  return results
}
