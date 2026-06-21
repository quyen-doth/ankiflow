'use client'

import { useCallback } from 'react'
import type { Entry } from '@/types'

interface NoteUpdate {
  noteId: number
  fields: Record<string, string>
}

function buildNoteUpdates(entry: Entry, updates: Partial<Entry>): NoteUpdate[] {
  if (!entry.anki_note_ids || entry.anki_note_ids.length === 0) return []

  const word = (updates.word ?? entry.word) || (updates.term ?? entry.term) || (updates.title ?? entry.title) || ''
  const reading = (updates.hiragana ?? entry.hiragana) || (updates.pinyin ?? entry.pinyin) || (updates.ipa ?? entry.ipa) || ''
  const meaning = (updates.meaning_vi ?? entry.meaning_vi) || (updates.definition ?? entry.definition) || ''
  const wordType = (updates.word_type ?? entry.word_type) || ''
  const example = (updates.example_sentence ?? entry.example_sentence) || ''
  const translation = (updates.example_translation ?? entry.example_translation) || ''

  const front = reading ? `${word}<br><small>${reading}</small>` : word
  const back = `${meaning}${wordType ? `<br><small>${wordType}</small>` : ''}`

  return entry.anki_note_ids.map(noteId => ({
    noteId,
    fields: { Front: front, Back: back },
  }))
}

export function useEntryEdit() {
  const saveEntry = useCallback(async (entry: Entry, updates: Partial<Entry>) => {
    const noteUpdates = buildNoteUpdates(entry, updates)

    const res = await fetch('/api/anki/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entryId: entry.id,
        updates,
        noteUpdates,
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
