import { canonicalizeLanguageCode } from '@/lib/studyLanguages'
import type { DashboardResponse } from '@/lib/dashboard/dashboardDto'

export const DASHBOARD_LANGUAGE_BATCH_SIZE = 20

export interface DashboardDayBounds {
  dayStart: string
  dayEnd: string
}

export function localDayBounds(now = new Date()): DashboardDayBounds {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return {
    dayStart: dayStart.toISOString(),
    dayEnd: dayEnd.toISOString(),
  }
}

function normalizeDashboardLanguages(languages: readonly string[]): string[] {
  const normalized: string[] = []
  const seen = new Set<string>()
  for (const value of languages) {
    const language = canonicalizeLanguageCode(value)
    const key = language?.toLocaleLowerCase('en-US')
    if (!language || !key || seen.has(key)) continue
    seen.add(key)
    normalized.push(language)
  }
  return normalized
}

export function buildDashboardUrl(
  bounds: DashboardDayBounds,
  languages: readonly string[],
): string {
  const params = new URLSearchParams({
    day_start: bounds.dayStart,
    day_end: bounds.dayEnd,
  })
  for (const language of normalizeDashboardLanguages(languages)) {
    params.append('language', language)
  }
  return `/api/dashboard?${params.toString()}`
}

async function requestDashboardBatch(
  bounds: DashboardDayBounds,
  languages: readonly string[],
  signal: AbortSignal,
): Promise<DashboardResponse> {
  const response = await fetch(buildDashboardUrl(bounds, languages), { signal })
  const body = await response.json().catch(() => ({})) as (
    Partial<DashboardResponse> & { error?: string }
  )
  if (!response.ok) throw new Error(body.error || 'Failed to load dashboard')
  if (!body.stats
    || !Array.isArray(body.language_counts)
    || !Array.isArray(body.recent_entries)) {
    throw new Error('Invalid dashboard response')
  }
  return {
    stats: body.stats,
    language_counts: body.language_counts,
    recent_entries: body.recent_entries,
  }
}

export async function requestDashboard(
  bounds: DashboardDayBounds,
  languages: readonly string[],
  signal: AbortSignal,
): Promise<DashboardResponse> {
  const normalizedLanguages = normalizeDashboardLanguages(languages)
  const batches = normalizedLanguages.length === 0
    ? [[]]
    : Array.from(
      { length: Math.ceil(normalizedLanguages.length / DASHBOARD_LANGUAGE_BATCH_SIZE) },
      (_, index) => normalizedLanguages.slice(
        index * DASHBOARD_LANGUAGE_BATCH_SIZE,
        (index + 1) * DASHBOARD_LANGUAGE_BATCH_SIZE,
      ),
    )

  let firstResponse: DashboardResponse | null = null
  const languageCounts: DashboardResponse['language_counts'] = []
  for (const batch of batches) {
    const response = await requestDashboardBatch(bounds, batch, signal)
    firstResponse ??= response
    languageCounts.push(...response.language_counts)
  }

  return {
    stats: firstResponse!.stats,
    language_counts: languageCounts,
    recent_entries: firstResponse!.recent_entries,
  }
}
