'use client'

import { useCallback } from 'react'
import { getAnkiClientFromSettings } from '@/lib/flashcard-service/client'
import { regenerateNotesForEntry } from '@/lib/flashcard-service/client-ops'
import type { CardTypeItem } from '@/lib/buildNotes'
import type { Entry } from '@/types'

export function useEntryEdit() {
  const saveEntry = useCallback(async (entry: Entry, updates: Partial<Entry>) => {
    // 1. Lưu Firestore + lấy dữ liệu để sinh lại note (server không đụng Anki).
    const res = await fetch('/api/anki/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId: entry.id, updates }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to update')
    }

    const data = (await res.json()) as {
      success: boolean
      entry: (Partial<Entry> & { anki_note_ids?: number[]; card_type_ids?: string[] }) | null
      cardTypes: CardTypeItem[]
      noteIds: number[]
    }

    // 2. Sinh lại note trong Anki (browser). Best-effort: Anki offline KHÔNG chặn việc đã lưu.
    if (data.entry && data.noteIds.length > 0) {
      try {
        const client = await getAnkiClientFromSettings()
        await regenerateNotesForEntry(client, data.entry, data.cardTypes)
      } catch (e) {
        console.warn('Anki note regen skipped (Anki offline?):', e)
      }
    }

    return data
  }, [])

  return { saveEntry }
}
