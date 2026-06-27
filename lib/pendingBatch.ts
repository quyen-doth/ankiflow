/**
 * pendingBatch.ts
 * Quản lý kết quả generate hàng loạt (batch) giữa Create page và trang review batch.
 * Soi gương lib/pendingEntry.ts nhưng giữ MẢNG generatedContent + metadata dùng chung.
 * Dữ liệu lưu vào localStorage, xóa sau khi trang review đã đọc.
 */

import { FormType, LanguageType } from '@/types'

const STORAGE_KEY = 'ankiflow_pending_batch'

/** Cấu trúc batch — N kết quả AI + metadata dùng chung từ session của user. */
export interface PendingBatch {
  /** Mỗi phần tử là kết quả từ Claude AI agent cho 1 thẻ (partial Entry fields). */
  items: Record<string, unknown>[]

  /** Metadata dùng chung cho cả batch. */
  formType: FormType | string
  language?: LanguageType | null
  deckId?: string
  categoryId?: string
  cardTypeIds: string[]
  tags: string[]

  /** Thời điểm lưu — để phát hiện dữ liệu stale. */
  savedAt: string
}

/** Lưu pending batch vào localStorage. */
export function savePendingBatch(data: PendingBatch): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Lỗi khi lưu pending batch:', e)
  }
}

/** Đọc pending batch từ localStorage. */
export function loadPendingBatch(): PendingBatch | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PendingBatch
  } catch (e) {
    console.error('Lỗi khi đọc pending batch:', e)
    return null
  }
}

/** Xóa pending batch khỏi localStorage (gọi sau khi trang review đã load xong). */
export function clearPendingBatch(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

/** Kiểm tra pending batch có bị stale (quá 30 phút) không. */
export function isPendingBatchStale(batch: PendingBatch): boolean {
  const savedAt = new Date(batch.savedAt).getTime()
  const now = Date.now()
  const THIRTY_MINUTES = 30 * 60 * 1000
  return now - savedAt > THIRTY_MINUTES
}
