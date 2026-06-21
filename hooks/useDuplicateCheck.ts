'use client'

import { useState, useCallback } from 'react'

interface DuplicateEntry {
  id: string
  word: string
  anki_deck: string
  status: string
  created_at: string | null
}

interface DuplicateCheckResult {
  isDuplicate: boolean
  duplicates: DuplicateEntry[]
  showWarning: boolean
  setShowWarning: (v: boolean) => void
  checkDuplicate: (word: string, language?: string) => Promise<boolean>
}

export function useDuplicateCheck(): DuplicateCheckResult {
  const [duplicates, setDuplicates] = useState<DuplicateEntry[]>([])
  const [showWarning, setShowWarning] = useState(false)

  const checkDuplicate = useCallback(async (word: string, language?: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/entries/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, language }),
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

  return {
    isDuplicate: duplicates.length > 0,
    duplicates,
    showWarning,
    setShowWarning,
    checkDuplicate,
  }
}
