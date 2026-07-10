/**
 * pendingEntry.ts
 * Create page と Preview page の間で generate 結果を一時的に管理する。
 * データは localStorage に保存され、Preview page が読み込んだ後に削除される。
 */

import { FormType } from '@/types'
import type { LanguageCode } from '@/types'

const STORAGE_KEY = 'ankiflow_pending_result'

/** pending データの構造 — AI 結果とセッションからのメタデータを組み合わせる */
export interface PendingEntry {
  /** Claude AI agent からの結果 (partial Entry fields) */
  generatedContent: Record<string, unknown>

  /** ユーザーセッションからのメタデータ */
  formType: FormType | string
  language?: LanguageCode | null
  deckId?: string
  categoryId?: string
  cardTypeIds: string[]
  tags: string[]

  /** 保存時刻 — stale データを検出するため */
  savedAt: string
}

/** pending entry を localStorage に保存 */
export function savePendingEntry(data: PendingEntry): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Lỗi khi lưu pending entry:', e)
  }
}

/** localStorage から pending entry を読み込む */
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

/** localStorage から pending entry を削除 (Preview page の読み込み完了後に呼ぶ) */
export function clearPendingEntry(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

/** pending entry が stale (30 分超過) かどうかをチェック */
export function isPendingEntryStale(entry: PendingEntry): boolean {
  const savedAt = new Date(entry.savedAt).getTime()
  const now = Date.now()
  const THIRTY_MINUTES = 30 * 60 * 1000
  return now - savedAt > THIRTY_MINUTES
}
