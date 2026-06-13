/**
 * pendingEntry.ts
 * Quản lý kết quả generate tạm thời giữa Create page và Preview page.
 * Dữ liệu được lưu vào localStorage và xóa sau khi Preview page đã đọc.
 */

import { FormType, LanguageType } from '@/types'

const STORAGE_KEY = 'ankiflow_pending_result'

/** Cấu trúc dữ liệu pending — kết hợp kết quả AI và metadata từ session */
export interface PendingEntry {
  /** Kết quả từ Claude AI agent (partial Entry fields) */
  generatedContent: Record<string, unknown>

  /** Metadata từ session của user */
  formType: FormType
  language?: LanguageType | null
  deckId?: string
  categoryId?: string
  cardTypeIds: string[]
  tags: string[]

  /** Thời điểm lưu — để phát hiện dữ liệu stale */
  savedAt: string
}

/** Lưu pending entry vào localStorage */
export function savePendingEntry(data: PendingEntry): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Lỗi khi lưu pending entry:', e)
  }
}

/** Đọc pending entry từ localStorage */
export function loadPendingEntry(): PendingEntry | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PendingEntry
  } catch (e) {
    console.error('Lỗi khi đọc pending entry:', e)
    return null
  }
}

/** Xóa pending entry khỏi localStorage (gọi sau khi Preview page đã load xong) */
export function clearPendingEntry(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

/** Kiểm tra pending entry có bị stale (quá 30 phút) không */
export function isPendingEntryStale(entry: PendingEntry): boolean {
  const savedAt = new Date(entry.savedAt).getTime()
  const now = Date.now()
  const THIRTY_MINUTES = 30 * 60 * 1000
  return now - savedAt > THIRTY_MINUTES
}
