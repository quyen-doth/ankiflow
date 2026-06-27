'use client'

import { useState, useCallback } from 'react'

interface DuplicateEntry {
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
  /** Kiểm tra trùng toàn cục cho nhiều từ (batch), trả về danh sách từng từ + bản trùng. */
  checkDuplicatesBatch: (words: string[]) => Promise<BatchDuplicateResult[]>
}

export function useDuplicateCheck(): DuplicateCheckResult {
  const [duplicates, setDuplicates] = useState<DuplicateEntry[]>([])
  const [showWarning, setShowWarning] = useState(false)

  const checkDuplicate = useCallback(async (word: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/entries/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      })
      if (!res.ok) return false
      const data = await res.json()
      if (data.isDuplicate) {
        setDuplicates(data.duplicates)
        setShowWarning(true)
        return true
      }
      setDuplicates([])
      return false
    } catch {
      return false
    }
  }, [])

  const checkDuplicatesBatch = useCallback(async (words: string[]): Promise<BatchDuplicateResult[]> => {
    try {
      const res = await fetch('/api/entries/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words }),
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
    checkDuplicatesBatch,
  }
}
