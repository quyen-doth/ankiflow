import { FormType, type Entry } from '@/types'
import { resolveRuntimeContentTypeCode } from '@/lib/contentTypes'
import { canonicalizeLanguageCode } from '@/lib/studyLanguages'

export const ALL_HISTORY_FILTERS = 'all' as const

export type HistoryStatusFilter = typeof ALL_HISTORY_FILTERS | Entry['status']

export interface HistoryFilters {
  search: string
  contentType: string
  language: string
  status: HistoryStatusFilter
}

export interface HistoryContentTypeOption {
  value: string
  label: string
}

interface HistoryContentTypeDefinition {
  code: string
  name: string
  sort_order: number
}

export const DEFAULT_HISTORY_FILTERS: HistoryFilters = {
  search: '',
  contentType: ALL_HISTORY_FILTERS,
  language: ALL_HISTORY_FILTERS,
  status: ALL_HISTORY_FILTERS,
}

/** Workspace definitions と entry routes を canonical routing key で一つの一覧にまとめる。 */
export function buildHistoryContentTypeOptions(
  contentTypes: readonly HistoryContentTypeDefinition[],
  entries: readonly Pick<Entry, 'form_type'>[],
): HistoryContentTypeOption[] {
  const labels = new Map<string, string>()
  const sortedContentTypes = [...contentTypes].sort((left, right) => (
    left.sort_order - right.sort_order
    || left.name.localeCompare(right.name)
    || left.code.localeCompare(right.code)
  ))

  for (const contentType of sortedContentTypes) {
    const routingCode = resolveRuntimeContentTypeCode(contentType.code)
    if (routingCode && !labels.has(routingCode)) labels.set(routingCode, contentType.name)
  }

  for (const entry of entries) {
    const routingCode = resolveRuntimeContentTypeCode(entry.form_type)
    if (routingCode && !labels.has(routingCode)) labels.set(routingCode, routingCode)
  }

  return [
    { value: ALL_HISTORY_FILTERS, label: 'All content types' },
    ...Array.from(labels, ([value, label]) => ({ value, label })),
  ]
}

export function filterHistoryEntries(entries: Entry[], filters: HistoryFilters): Entry[] {
  const search = filters.search.toLowerCase()
  const contentType = filters.contentType === ALL_HISTORY_FILTERS
    ? ALL_HISTORY_FILTERS
    : resolveRuntimeContentTypeCode(filters.contentType)

  return entries.filter(entry => {
    if (filters.status !== ALL_HISTORY_FILTERS && entry.status !== filters.status) {
      return false
    }

    if (
      contentType !== ALL_HISTORY_FILTERS
      && resolveRuntimeContentTypeCode(entry.form_type) !== contentType
    ) {
      return false
    }

    if (
      contentType === FormType.LANGUAGE
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
