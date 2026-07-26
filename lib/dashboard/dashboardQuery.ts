import {
  AggregateField,
  Timestamp,
  type DocumentData,
  type Firestore,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import { z } from 'zod'
import { GLOBAL_SETTINGS_DOC_ID } from '@/lib/constants'
import { resolveRuntimeContentTypeCode } from '@/lib/contentTypes'
import {
  ENTRY_QUERY_CARD_COUNT_FIELD,
  ENTRY_QUERY_GLOBAL_VERSION_FIELD,
  ENTRY_QUERY_SCHEMA_VERSION,
} from '@/lib/entries/queryMetadata'
import { canonicalizeLanguageCode } from '@/lib/studyLanguages'
import { FormType, type Entry } from '@/types'
import type {
  DashboardLanguageCount,
  DashboardRecentEntry,
  DashboardResponse,
  DashboardStats,
} from '@/lib/dashboard/dashboardDto'

export const DASHBOARD_RECENT_LIMIT = 6
export const MAX_DASHBOARD_LANGUAGES = 20

const MIN_LOCAL_DAY_MS = 22 * 60 * 60 * 1_000
const MAX_LOCAL_DAY_MS = 26 * 60 * 60 * 1_000

const DASHBOARD_RECENT_PROJECTION = [
  'form_type',
  'language',
  'word',
  'term',
  'title',
  'meaning_vi',
  'definition',
  'content',
  'status',
] as const

const DASHBOARD_FALLBACK_PROJECTION = [
  'form_type',
  'language',
  'status',
  'created_at',
  'card_type_ids',
  ENTRY_QUERY_CARD_COUNT_FIELD,
] as const

const dashboardQuerySchema = z.object({
  day_start: z.iso.datetime({ offset: true }),
  day_end: z.iso.datetime({ offset: true }),
  languages: z.array(z.string().trim().min(1).max(35))
    .max(MAX_DASHBOARD_LANGUAGES),
}).superRefine((value, context) => {
  const start = new Date(value.day_start)
  const end = new Date(value.day_end)
  const duration = end.getTime() - start.getTime()
  if (duration <= 0 || duration < MIN_LOCAL_DAY_MS || duration > MAX_LOCAL_DAY_MS) {
    context.addIssue({
      code: 'custom',
      path: ['day_end'],
      message: 'day bounds must describe one local calendar day',
    })
  }
  value.languages.forEach((language, index) => {
    if (!canonicalizeLanguageCode(language)) {
      context.addIssue({
        code: 'custom',
        path: ['languages', index],
        message: 'invalid language code',
      })
    }
  })
})

export interface DashboardQueryParams {
  dayStart: Date
  dayEnd: Date
  languages: string[]
}

export type DashboardQueryParseResult =
  | { success: true; data: DashboardQueryParams }
  | { success: false }

export function parseDashboardQueryParams(url: URL): DashboardQueryParseResult {
  const parsed = dashboardQuerySchema.safeParse({
    day_start: url.searchParams.get('day_start') ?? undefined,
    day_end: url.searchParams.get('day_end') ?? undefined,
    languages: url.searchParams.getAll('language'),
  })
  if (!parsed.success) return { success: false }

  const seen = new Set<string>()
  const languages: string[] = []
  for (const value of parsed.data.languages) {
    const language = canonicalizeLanguageCode(value)
    const key = language?.toLocaleLowerCase('en-US')
    if (!language || !key || seen.has(key)) continue
    seen.add(key)
    languages.push(language)
  }
  return {
    success: true,
    data: {
      dayStart: new Date(parsed.data.day_start),
      dayEnd: new Date(parsed.data.day_end),
      languages,
    },
  }
}

function stringValue(data: DocumentData, field: string): string | undefined {
  return typeof data[field] === 'string' ? data[field] : undefined
}

function entryStatus(value: unknown): Entry['status'] {
  return value === 'reviewed' || value === 'synced' ? value : 'draft'
}

function toRecentEntry(snapshot: QueryDocumentSnapshot): DashboardRecentEntry {
  const data = snapshot.data()
  return {
    id: snapshot.id,
    form_type: resolveRuntimeContentTypeCode(stringValue(data, 'form_type') ?? ''),
    ...(stringValue(data, 'language') ? { language: stringValue(data, 'language') } : {}),
    ...(stringValue(data, 'word') ? { word: stringValue(data, 'word') } : {}),
    ...(stringValue(data, 'term') ? { term: stringValue(data, 'term') } : {}),
    ...(stringValue(data, 'title') ? { title: stringValue(data, 'title') } : {}),
    ...(stringValue(data, 'meaning_vi')
      ? { meaning_vi: stringValue(data, 'meaning_vi') }
      : {}),
    ...(stringValue(data, 'definition')
      ? { definition: stringValue(data, 'definition') }
      : {}),
    ...(stringValue(data, 'content') ? { content: stringValue(data, 'content') } : {}),
    status: entryStatus(data.status),
  }
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function cardCount(data: DocumentData): number {
  const derived = data[ENTRY_QUERY_CARD_COUNT_FIELD]
  if (typeof derived === 'number' && Number.isSafeInteger(derived) && derived >= 0) {
    return derived
  }
  return Array.isArray(data.card_type_ids)
    ? data.card_type_ids.filter((value: unknown) => (
      typeof value === 'string' && value.trim().length > 0
    )).length
    : 0
}

function timestampMillis(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null
  const toDate = (value as { toDate?: () => unknown }).toDate
  if (typeof toDate !== 'function') return null
  const date = toDate.call(value)
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : null
}

function languageFormValues(): string[] {
  return [FormType.LANGUAGE, 'language']
}

async function isQuerySchemaReady(db: Firestore): Promise<boolean> {
  const snapshot = await db.collection('settings').doc(GLOBAL_SETTINGS_DOC_ID).get()
  return snapshot.data()?.[ENTRY_QUERY_GLOBAL_VERSION_FIELD] === ENTRY_QUERY_SCHEMA_VERSION
}

async function loadRecentEntries(
  baseQuery: Query,
): Promise<DashboardRecentEntry[]> {
  const snapshot = await baseQuery
    .orderBy('created_at', 'desc')
    .select(...DASHBOARD_RECENT_PROJECTION)
    .limit(DASHBOARD_RECENT_LIMIT)
    .get()
  return snapshot.docs.map(toRecentEntry)
}

async function loadAggregateStats(
  baseQuery: Query,
  params: DashboardQueryParams,
): Promise<{ stats: DashboardStats; languageCounts: DashboardLanguageCount[] }> {
  const totalsPromise = baseQuery.aggregate({
    total_vocabulary: AggregateField.count(),
    total_cards: AggregateField.sum(ENTRY_QUERY_CARD_COUNT_FIELD),
  }).get()
  const todayPromise = baseQuery
    .where('created_at', '>=', Timestamp.fromDate(params.dayStart))
    .where('created_at', '<', Timestamp.fromDate(params.dayEnd))
    .count()
    .get()
  const syncedPromise = baseQuery
    .where('status', '==', 'synced')
    .count()
    .get()
  const languagePromises = params.languages.map(async language => {
    const snapshot = await baseQuery
      .where('form_type', 'in', languageFormValues())
      .where('language', '==', language)
      .count()
      .get()
    return { language, count: snapshot.data().count }
  })

  const [totalsSnapshot, todaySnapshot, syncedSnapshot, languageCounts] = await Promise.all([
    totalsPromise,
    todayPromise,
    syncedPromise,
    Promise.all(languagePromises),
  ])
  const totals = totalsSnapshot.data()
  return {
    stats: {
      total_vocabulary: numberValue(totals.total_vocabulary),
      total_cards: numberValue(totals.total_cards),
      created_today: numberValue(todaySnapshot.data().count),
      synced: numberValue(syncedSnapshot.data().count),
    },
    languageCounts,
  }
}

async function loadFallbackStats(
  baseQuery: Query,
  params: DashboardQueryParams,
): Promise<{ stats: DashboardStats; languageCounts: DashboardLanguageCount[] }> {
  const snapshot = await baseQuery
    .select(...DASHBOARD_FALLBACK_PROJECTION)
    .get()
  const languageCounts = new Map(params.languages.map(language => [language, 0]))
  let totalCards = 0
  let createdToday = 0
  let synced = 0

  for (const document of snapshot.docs) {
    const data = document.data()
    totalCards += cardCount(data)
    const createdAt = timestampMillis(data.created_at)
    if (createdAt !== null
      && createdAt >= params.dayStart.getTime()
      && createdAt < params.dayEnd.getTime()) {
      createdToday += 1
    }
    if (data.status === 'synced') synced += 1
    if (resolveRuntimeContentTypeCode(stringValue(data, 'form_type') ?? '')
      !== FormType.LANGUAGE) {
      continue
    }
    const language = stringValue(data, 'language')
    const canonical = language ? canonicalizeLanguageCode(language) : null
    if (canonical && languageCounts.has(canonical)) {
      languageCounts.set(canonical, (languageCounts.get(canonical) ?? 0) + 1)
    }
  }

  return {
    stats: {
      total_vocabulary: snapshot.docs.length,
      total_cards: totalCards,
      created_today: createdToday,
      synced,
    },
    languageCounts: params.languages.map(language => ({
      language,
      count: languageCounts.get(language) ?? 0,
    })),
  }
}

export async function loadDashboard(
  db: Firestore,
  uid: string,
  params: DashboardQueryParams,
): Promise<DashboardResponse> {
  const baseQuery = db.collection('entries').where('user_id', '==', uid)
  const ready = await isQuerySchemaReady(db)
  const [summary, recentEntries] = await Promise.all([
    ready
      ? loadAggregateStats(baseQuery, params)
      : loadFallbackStats(baseQuery, params),
    loadRecentEntries(baseQuery),
  ])
  return {
    stats: summary.stats,
    language_counts: summary.languageCounts,
    recent_entries: recentEntries,
  }
}
