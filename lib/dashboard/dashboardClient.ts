import { canonicalizeLanguageCode } from '@/lib/studyLanguages'
import type { DashboardResponse } from '@/lib/dashboard/dashboardDto'

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

export function buildDashboardUrl(
  bounds: DashboardDayBounds,
  languages: readonly string[],
): string {
  const params = new URLSearchParams({
    day_start: bounds.dayStart,
    day_end: bounds.dayEnd,
  })
  const seen = new Set<string>()
  for (const value of languages) {
    const language = canonicalizeLanguageCode(value)
    const key = language?.toLocaleLowerCase('en-US')
    if (!language || !key || seen.has(key)) continue
    seen.add(key)
    params.append('language', language)
  }
  return `/api/dashboard?${params.toString()}`
}

export async function requestDashboard(
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
