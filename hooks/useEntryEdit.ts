'use client'

import { useCallback } from 'react'
import type { Entry } from '@/types'

export function useEntryEdit() {
  const saveEntry = useCallback(async (entry: Entry, updates: Partial<Entry>) => {
    // Server sẽ tự sinh lại note Anki theo template hiện tại (giữ media + SRS).
    const res = await fetch('/api/anki/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entryId: entry.id,
        updates,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to update')
    }

    return await res.json()
  }, [])

  return { saveEntry }
}
