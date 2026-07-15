'use client'

import { useState, useCallback } from 'react'

export interface DuplicateEntry {
  id: string
  word: string
  anki_deck: string
  status: string
  created_at: string | null
}

export interface BatchDuplicateResult {
  word: string
  duplicates: DuplicateEntry[]
}

interface DuplicateCheckResult {
  isDuplicate: boolean
  duplicates: DuplicateEntry[]
  showWarning: boolean
  setShowWarning: (v: boolean) => void
  /** Kiểm tra trùng TOÀN CỤC (không kể deck/ngôn ngữ) cho 1 từ. */
  checkDuplicate: (word: string) => Promise<boolean>
  /** 重複データの取得のみ (state 副作用なし) — 並列実行用。失敗時は空配列。 */
  fetchDuplicates: (word: string, signal?: AbortSignal) => Promise<DuplicateEntry[]>
  /** 事前取得した結果で DuplicateModal を表示する。 */
  presentDuplicates: (found: DuplicateEntry[]) => void
  /** Kiểm tra trùng toàn cục cho nhiều từ (batch), trả về danh sách từng từ + bản trùng. */
  checkDuplicatesBatch: (words: string[], signal?: AbortSignal) => Promise<BatchDuplicateResult[]>
}

export function useDuplicateCheck(): DuplicateCheckResult {
  const [duplicates, setDuplicates] = useState<DuplicateEntry[]>([])
  const [showWarning, setShowWarning] = useState(false)

  const fetchDuplicates = useCallback(async (word: string, signal?: AbortSignal): Promise<DuplicateEntry[]> => {
    try {
      const res = await fetch('/api/entries/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
        signal,
      })
      if (!res.ok) return []
      const data = await res.json()
      return (data.duplicates as DuplicateEntry[]) ?? []
    } catch {
      return []
    }
  }, [])

  const presentDuplicates = useCallback((found: DuplicateEntry[]): void => {
    setDuplicates(found)
    setShowWarning(true)
  }, [])

  const checkDuplicate = useCallback(async (word: string): Promise<boolean> => {
    const found = await fetchDuplicates(word)
    if (found.length > 0) {
      presentDuplicates(found)
      return true
    }
    setDuplicates([])
    return false
  }, [fetchDuplicates, presentDuplicates])

  const checkDuplicatesBatch = useCallback(async (words: string[], signal?: AbortSignal): Promise<BatchDuplicateResult[]> => {
    try {
      const res = await fetch('/api/entries/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words }),
        signal,
      })
      if (!res.ok) return []
      const data = await res.json()
      return (data.results as BatchDuplicateResult[]) ?? []
    } catch {
      return []
    }
  }, [])

  return {
    isDuplicate: duplicates.length > 0,
    duplicates,
    showWarning,
    setShowWarning,
    checkDuplicate,
    fetchDuplicates,
    presentDuplicates,
    checkDuplicatesBatch,
  }
}
