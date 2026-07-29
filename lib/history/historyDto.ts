import type { Entry } from '@/types'

export interface HistoryEntrySummary {
  id: string
  form_type: string
  language?: string
  word?: string
  term?: string
  title?: string
  meaning_vi?: string
  definition?: string
  content?: string
  anki_deck: string
  anki_note_ids: number[]
  card_count: number
  status: Entry['status']
  created_at: string | null
}

export interface HistoryListResponse {
  entries: HistoryEntrySummary[]
  total: number
  next_cursor: string | null
}

export interface HistoryFacetsResponse {
  form_types: string[]
  languages: string[]
}

export function applyHistorySummaryUpdates(
  summary: HistoryEntrySummary,
  updates: Partial<Entry>,
): HistoryEntrySummary {
  return {
    ...summary,
    ...(typeof updates.word === 'string' ? { word: updates.word } : {}),
    ...(typeof updates.term === 'string' ? { term: updates.term } : {}),
    ...(typeof updates.title === 'string' ? { title: updates.title } : {}),
    ...(typeof updates.meaning_vi === 'string' ? { meaning_vi: updates.meaning_vi } : {}),
    ...(typeof updates.definition === 'string' ? { definition: updates.definition } : {}),
    ...(typeof updates.content === 'string' ? { content: updates.content } : {}),
  }
}
