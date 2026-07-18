'use client'

import { useCallback } from 'react'
import { getAnkiClientFromSettings } from '@/lib/flashcard-service/client'
import type { Entry } from '@/types'

export interface DeleteEntriesResult {
  deleted: number
  ankiCleaned: boolean
}

export function useEntryDelete() {
  const deleteEntries = useCallback(async (entries: Entry[]): Promise<DeleteEntriesResult> => {
    const ids = [...new Set(entries.flatMap(entry => (
      typeof entry.id === 'string' && entry.id ? [entry.id] : []
    )))]
    if (ids.length === 0) throw new Error('No cards selected for deletion')

    const noteIds = [...new Set(entries.flatMap(entry => (
      (entry.anki_note_ids ?? []).filter(noteId => Number.isSafeInteger(noteId) && noteId > 0)
    )))]
    let ankiCleaned = noteIds.length === 0

    if (noteIds.length > 0) {
      try {
        const client = await getAnkiClientFromSettings()
        await client.deleteNotes(noteIds)
        ankiCleaned = true
      } catch {
        // Anki offline/CORS の失敗でも Firestore の削除は継続する。
        ankiCleaned = false
      }
    }

    const response = await fetch('/api/history/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, anki_cleaned: ankiCleaned }),
    })
    const body = await response.json().catch(() => ({})) as {
      deleted?: number
      error?: string
    }
    if (!response.ok) throw new Error(body.error || 'Failed to delete cards')

    return {
      deleted: typeof body.deleted === 'number' ? body.deleted : 0,
      ankiCleaned,
    }
  }, [])

  return { deleteEntries }
}
