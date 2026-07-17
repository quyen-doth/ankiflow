/**
 * pendingBatch.ts
 * Create page と batch review ページの間で一括 (batch) generate 結果を管理する。
 * lib/pendingEntry.ts を鏡写しにしているが、generatedContent の配列 + 共有メタデータを保持。
 * データは localStorage に保存され、review ページが読み込んだ後に削除される。
 */

import { FormType } from '@/types'
import type { LanguageCode } from '@/types'

const STORAGE_KEY = 'ankiflow_pending_batch'

/** batch の構造 — N 個の AI 結果 + ユーザーセッションからの共有メタデータ。 */
export interface PendingBatch {
  /** 各要素は Claude AI agent による 1 枚のカードの結果 (partial Entry fields)。 */
  items: Record<string, unknown>[]

  /** batch 全体で共有するメタデータ。 */
  formType: FormType | string
  language?: LanguageCode | null
  outputLanguage?: LanguageCode
  deckId?: string
  categoryId?: string
  cardTypeIds: string[]
  topicIds?: string[]
  tags: string[]

  /** 保存時刻 — stale データを検出するため。 */
  savedAt: string
}

/** pending batch を localStorage に保存。 */
export function savePendingBatch(data: PendingBatch): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (e) {
    console.error('Lỗi khi lưu pending batch:', e)
  }
}

/** localStorage から pending batch を読み込む。 */
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

/** localStorage から pending batch を削除 (review ページの読み込み完了後に呼ぶ)。 */
export function clearPendingBatch(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

/** pending batch が stale (30 分超過) かどうかをチェック。 */
export function isPendingBatchStale(batch: PendingBatch): boolean {
  const savedAt = new Date(batch.savedAt).getTime()
  const now = Date.now()
  const THIRTY_MINUTES = 30 * 60 * 1000
  return now - savedAt > THIRTY_MINUTES
}
