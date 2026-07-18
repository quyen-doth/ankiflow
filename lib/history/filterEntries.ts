import { FormType, type Entry } from '@/types'
import { canonicalizeLanguageCode } from '@/lib/studyLanguages'

export const ALL_HISTORY_FILTERS = 'all' as const

export type HistoryStatusFilter = typeof ALL_HISTORY_FILTERS | Entry['status']

export interface HistoryFilters {
  search: string
  contentType: string
  language: string
  status: HistoryStatusFilter
}

export const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  search: '',
  contentType: ALL_HISTORY_FILTERS,
  language: ALL_HISTORY_FILTERS,
  status: ALL_HISTORY_FILTERS,
}

export function filterHistoryEntries(entries: Entry[], filters: HistoryFilters): Entry[] {
  const search = filters.search.toLowerCase()

  return entries.filter(entry => {
    if (filters.status !== ALL_HISTORY_FILTERS && entry.status !== filters.status) {
      return false
    }

    if (filters.contentType !== ALL_HISTORY_FILTERS && entry.form_type !== filters.contentType) {
      return false
    }

    if (
      filters.contentType === FormType.LANGUAGE
      && filters.language !== ALL_HISTORY_FILTERS
    ) {
      const language = entry.language
        ? canonicalizeLanguageCode(entry.language) ?? entry.language
        : ''
      if (language !== filters.language) return false
    }

    if (!search) return true
    const primary = (entry.word || entry.term || entry.title || '').toLowerCase()
    const meaning = (entry.meaning_vi || entry.definition || entry.content || '').toLowerCase()
    return primary.includes(search) || meaning.includes(search)
  })
}
