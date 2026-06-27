/**
 * batchGenerate.ts
 * Sinh nội dung cho NHIỀU thẻ trong 1 lượt, dùng chung 1 blueprint + session.
 * Mỗi item (field chính) chạy qua đúng `blueprint.generate` như luồng đơn, nhưng có
 * giới hạn concurrency để tránh rate-limit và báo tiến độ qua onProgress.
 */

import { LanguageType } from '@/types'
import type { SessionState } from '@/lib/session'
import type { CardFormBlueprint } from '@/lib/create/formBlueprint'

/** Số request chạy song song tối đa khi generate batch. */
export const BATCH_CONCURRENCY = 3

/** Kết quả generate cho 1 item — giữ thứ tự theo input. */
export interface BatchGenResult {
  item: string
  ok: boolean
  /** Nội dung AI (partial Entry fields) khi ok = true. */
  content?: Record<string, unknown>
  /** Thông điệp lỗi khi ok = false. */
  error?: string
}

interface GenerateBatchOptions {
  /** Gọi sau mỗi thẻ hoàn tất (thành công hoặc lỗi). */
  onProgress?: (done: number, total: number) => void
  /** Cho phép hủy giữa chừng — truyền vào fetch và dừng lấy item mới. */
  signal?: AbortSignal
}

/** Sinh nội dung cho 1 item dựa trên blueprint.generate (api hoặc local). */
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
 * Generate cho danh sách item. Trả về mảng kết quả THEO ĐÚNG thứ tự item.
 * Một item lỗi không làm dừng cả batch — được đánh dấu ok:false.
 */
export async function generateBatch(
  blueprint: CardFormBlueprint,
  items: string[],
  session: SessionState,
  options: GenerateBatchOptions = {},
): Promise<BatchGenResult[]> {
  const { onProgress, signal } = options

  // Chuẩn hóa session: với content type ngôn ngữ, mặc định English nếu thiếu.
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
      if (signal?.aborted) return // dừng lấy item mới khi đã hủy
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
