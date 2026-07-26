import { FormType } from '@/types'
import {
  ALL_HISTORY_FILTERS,
  type HistoryFilters,
} from '@/lib/history/filterEntries'
import type { HistoryListResponse } from '@/lib/history/historyDto'

export const HISTORY_PAGE_SIZE = 50
export const HISTORY_SEARCH_DEBOUNCE_MS = 300

export function buildHistoryListUrl(
  filters: HistoryFilters,
  cursor?: string,
): string {
  const params = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE) })
  const keyword = filters.search.trim()
  if (keyword) params.set('keyword', keyword)
  if (filters.contentType !== ALL_HISTORY_FILTERS) {
    params.set('form_type', filters.contentType)
  }
  if (filters.contentType === FormType.LANGUAGE
    && filters.language !== ALL_HISTORY_FILTERS) {
    params.set('language', filters.language)
  }
  if (filters.status !== ALL_HISTORY_FILTERS) params.set('status', filters.status)
  if (cursor) params.set('cursor', cursor)
  return `/api/history?${params.toString()}`
}

export async function requestHistory(
  filters: HistoryFilters,
  cursor: string | undefined,
  signal: AbortSignal,
): Promise<HistoryListResponse> {
  const response = await fetch(buildHistoryListUrl(filters, cursor), { signal })
  const body = await response.json().catch(() => ({})) as (
    Partial<HistoryListResponse> & { error?: string }
  )
  if (!response.ok) throw new Error(body.error || 'Failed to load card history')
  return {
    entries: Array.isArray(body.entries) ? body.entries : [],
    total: typeof body.total === 'number' ? body.total : 0,
    next_cursor: typeof body.next_cursor === 'string' ? body.next_cursor : null,
  }
}
