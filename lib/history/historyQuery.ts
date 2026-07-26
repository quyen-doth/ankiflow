import {
  FieldPath,
  Timestamp,
  type DocumentData,
  type Firestore,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore'
import { z } from 'zod'
import { resolveRuntimeContentTypeCode } from '@/lib/contentTypes'
import { canonicalizeLanguageCode } from '@/lib/studyLanguages'
import { FormType, type Entry } from '@/types'
import {
  type HistoryEntrySummary,
  type HistoryFacetsResponse,
  type HistoryListResponse,
} from '@/lib/history/historyDto'
import { ENTRY_QUERY_CARD_COUNT_FIELD } from '@/lib/entries/queryMetadata'

export const DEFAULT_HISTORY_PAGE_SIZE = 50
export const MAX_HISTORY_PAGE_SIZE = 100

const HISTORY_SUMMARY_PROJECTION = [
  'form_type',
  'language',
  'word',
  'term',
  'title',
  'meaning_vi',
  'definition',
  'content',
  'anki_deck',
  'anki_note_ids',
  'card_type_ids',
  ENTRY_QUERY_CARD_COUNT_FIELD,
  'status',
  'created_at',
] as const

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_HISTORY_PAGE_SIZE)
    .default(DEFAULT_HISTORY_PAGE_SIZE),
  form_type: z.string().trim().min(1).max(100).optional(),
  language: z.string().trim().min(1).max(35).optional(),
  status: z.enum(['draft', 'reviewed', 'synced']).optional(),
  category_id: z.string().trim().min(1).max(200).optional(),
  keyword: z.string().trim().min(1).max(200).optional(),
  cursor: z.string().trim().min(1).max(5_000).optional(),
}).superRefine((value, context) => {
  if (value.language
    && (!value.form_type
      || resolveRuntimeContentTypeCode(value.form_type) !== FormType.LANGUAGE)) {
    context.addIssue({
      code: 'custom',
      path: ['language'],
      message: 'language requires the Language content type filter',
    })
  }
})

export interface HistoryListParams {
  pageSize: number
  formType?: string
  language?: string
  status?: Entry['status']
  categoryId?: string
  keyword?: string
  cursor?: string
}

export type HistoryQueryParseResult =
  | { success: true; data: HistoryListParams }
  | { success: false }

interface HistoryCursorPayload {
  version: 1
  seconds: number
  nanoseconds: number
  id: string
  scope: string
}

const cursorSchema = z.object({
  version: z.literal(1),
  seconds: z.number().int(),
  nanoseconds: z.number().int().min(0).max(999_999_999),
  id: z.string().min(1).max(1_500),
  scope: z.string(),
})

export class InvalidHistoryCursorError extends Error {}

export function parseHistoryListParams(url: URL): HistoryQueryParseResult {
  const value = {
    limit: url.searchParams.get('limit') ?? undefined,
    form_type: url.searchParams.get('form_type') ?? undefined,
    language: url.searchParams.get('language') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    category_id: url.searchParams.get('category_id') ?? undefined,
    keyword: url.searchParams.get('keyword') ?? undefined,
    cursor: url.searchParams.get('cursor') ?? undefined,
  }
  const parsed = historyQuerySchema.safeParse(value)
  if (!parsed.success) return { success: false }
  return {
    success: true,
    data: {
      pageSize: parsed.data.limit,
      ...(parsed.data.form_type ? { formType: parsed.data.form_type } : {}),
      ...(parsed.data.language
        ? { language: canonicalizeLanguageCode(parsed.data.language) ?? parsed.data.language }
        : {}),
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.category_id ? { categoryId: parsed.data.category_id } : {}),
      ...(parsed.data.keyword ? { keyword: parsed.data.keyword } : {}),
      ...(parsed.data.cursor ? { cursor: parsed.data.cursor } : {}),
    },
  }
}

function formTypeValues(formType: string): string[] {
  const canonical = resolveRuntimeContentTypeCode(formType)
  if (canonical === FormType.LANGUAGE) return [FormType.LANGUAGE, 'language']
  if (canonical === FormType.IT) return [FormType.IT, 'it']
  if (canonical === FormType.GENERAL) return [FormType.GENERAL, 'general']
  return [canonical]
}

function applyHistoryFilters(
  db: Firestore,
  uid: string,
  params: HistoryListParams,
): Query {
  let query: Query = db.collection('entries').where('user_id', '==', uid)
  if (params.formType) {
    const values = formTypeValues(params.formType)
    query = values.length === 1
      ? query.where('form_type', '==', values[0])
      : query.where('form_type', 'in', values)
  }
  if (params.language) query = query.where('language', '==', params.language)
  if (params.status) query = query.where('status', '==', params.status)
  if (params.categoryId) query = query.where('category_id', '==', params.categoryId)
  return query
}

function queryScope(params: HistoryListParams): string {
  return JSON.stringify({
    formType: params.formType ?? null,
    language: params.language ?? null,
    status: params.status ?? null,
    categoryId: params.categoryId ?? null,
    keyword: params.keyword?.toLocaleLowerCase('en-US') ?? null,
  })
}

function decodeCursor(cursor: string, scope: string): HistoryCursorPayload {
  try {
    const raw: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    const parsed = cursorSchema.safeParse(raw)
    if (!parsed.success || parsed.data.scope !== scope) {
      throw new InvalidHistoryCursorError('Invalid history cursor')
    }
    return parsed.data
  } catch (error) {
    if (error instanceof InvalidHistoryCursorError) throw error
    throw new InvalidHistoryCursorError('Invalid history cursor')
  }
}

interface TimestampParts {
  seconds: number
  nanoseconds: number
}

function timestampParts(value: unknown): TimestampParts | null {
  if (!value || typeof value !== 'object') return null
  const seconds = (value as { seconds?: unknown }).seconds
  const nanoseconds = (value as { nanoseconds?: unknown }).nanoseconds
  return Number.isInteger(seconds) && Number.isInteger(nanoseconds)
    ? { seconds: seconds as number, nanoseconds: nanoseconds as number }
    : null
}

function encodeCursor(
  snapshot: QueryDocumentSnapshot,
  scope: string,
): string {
  const parts = timestampParts(snapshot.data().created_at)
  if (!parts) throw new InvalidHistoryCursorError('History cursor timestamp is missing')
  const payload: HistoryCursorPayload = {
    version: 1,
    ...parts,
    id: snapshot.id,
    scope,
  }
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function stringValue(data: DocumentData, field: string): string | undefined {
  return typeof data[field] === 'string' ? data[field] : undefined
}

function validNoteIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is number => (
    typeof item === 'number' && Number.isSafeInteger(item) && item > 0
  ))
}

function cardCount(data: DocumentData): number {
  if (typeof data[ENTRY_QUERY_CARD_COUNT_FIELD] === 'number'
    && Number.isSafeInteger(data[ENTRY_QUERY_CARD_COUNT_FIELD])
    && data[ENTRY_QUERY_CARD_COUNT_FIELD] >= 0) {
    return data[ENTRY_QUERY_CARD_COUNT_FIELD]
  }
  return Array.isArray(data.card_type_ids)
    ? data.card_type_ids.filter((item: unknown) => (
      typeof item === 'string' && item.trim().length > 0
    )).length
    : 0
}

function entryStatus(value: unknown): Entry['status'] {
  return value === 'reviewed' || value === 'synced' ? value : 'draft'
}

function createdAtIso(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const toDate = (value as { toDate?: () => unknown }).toDate
  if (typeof toDate !== 'function') return null
  const date = toDate.call(value)
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null
}

function toSummary(snapshot: QueryDocumentSnapshot): HistoryEntrySummary {
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
    anki_deck: stringValue(data, 'anki_deck') ?? '',
    anki_note_ids: validNoteIds(data.anki_note_ids),
    card_count: cardCount(data),
    status: entryStatus(data.status),
    created_at: createdAtIso(data.created_at),
  }
}

function matchesKeyword(snapshot: QueryDocumentSnapshot, keyword: string): boolean {
  const data = snapshot.data()
  const primary = (
    stringValue(data, 'word')
    || stringValue(data, 'term')
    || stringValue(data, 'title')
    || ''
  ).toLocaleLowerCase('en-US')
  const meaning = (
    stringValue(data, 'meaning_vi')
    || stringValue(data, 'definition')
    || stringValue(data, 'content')
    || ''
  ).toLocaleLowerCase('en-US')
  const search = keyword.toLocaleLowerCase('en-US')
  return primary.includes(search) || meaning.includes(search)
}

function isAfterCursor(
  snapshot: QueryDocumentSnapshot,
  cursor: HistoryCursorPayload,
): boolean {
  const parts = timestampParts(snapshot.data().created_at)
  if (!parts) return false
  if (parts.seconds !== cursor.seconds) return parts.seconds < cursor.seconds
  if (parts.nanoseconds !== cursor.nanoseconds) return parts.nanoseconds < cursor.nanoseconds
  return snapshot.id < cursor.id
}

function orderedQuery(query: Query): Query {
  return query
    .orderBy('created_at', 'desc')
    .orderBy(FieldPath.documentId(), 'desc')
}

async function loadKeywordPage(
  baseQuery: Query,
  params: HistoryListParams,
  scope: string,
): Promise<HistoryListResponse> {
  const snapshot = await orderedQuery(baseQuery)
    .select(...HISTORY_SUMMARY_PROJECTION)
    .get()
  const matched = snapshot.docs.filter(document => matchesKeyword(document, params.keyword ?? ''))
  const cursor = params.cursor ? decodeCursor(params.cursor, scope) : null
  const eligible = cursor
    ? matched.filter(document => isAfterCursor(document, cursor))
    : matched
  const page = eligible.slice(0, params.pageSize)
  return {
    entries: page.map(toSummary),
    total: matched.length,
    next_cursor: eligible.length > params.pageSize && page.length > 0
      ? encodeCursor(page[page.length - 1], scope)
      : null,
  }
}

export async function loadHistoryPage(
  db: Firestore,
  uid: string,
  params: HistoryListParams,
): Promise<HistoryListResponse> {
  const baseQuery = applyHistoryFilters(db, uid, params)
  const scope = queryScope(params)
  if (params.keyword) return loadKeywordPage(baseQuery, params, scope)

  const cursor = params.cursor ? decodeCursor(params.cursor, scope) : null
  let pageQuery = orderedQuery(baseQuery)
  if (cursor) {
    pageQuery = pageQuery.startAfter(
      new Timestamp(cursor.seconds, cursor.nanoseconds),
      cursor.id,
    )
  }
  const [snapshot, countSnapshot] = await Promise.all([
    pageQuery
      .select(...HISTORY_SUMMARY_PROJECTION)
      .limit(params.pageSize + 1)
      .get(),
    baseQuery.count().get(),
  ])
  const hasMore = snapshot.docs.length > params.pageSize
  const page = snapshot.docs.slice(0, params.pageSize)
  return {
    entries: page.map(toSummary),
    total: countSnapshot.data().count,
    next_cursor: hasMore && page.length > 0
      ? encodeCursor(page[page.length - 1], scope)
      : null,
  }
}

export async function loadHistoryFacets(
  db: Firestore,
  uid: string,
): Promise<HistoryFacetsResponse> {
  const snapshot = await db.collection('entries')
    .where('user_id', '==', uid)
    .select('form_type', 'language')
    .get()
  const formTypes = new Set<string>()
  const languages = new Set<string>()
  for (const document of snapshot.docs) {
    const data = document.data()
    const formType = typeof data.form_type === 'string' && data.form_type
      ? resolveRuntimeContentTypeCode(data.form_type)
      : ''
    if (typeof data.form_type === 'string' && data.form_type) {
      formTypes.add(formType)
    }
    if (formType === FormType.LANGUAGE
      && typeof data.language === 'string'
      && data.language) {
      languages.add(canonicalizeLanguageCode(data.language) ?? data.language)
    }
  }
  return {
    form_types: [...formTypes].sort(),
    languages: [...languages].sort(),
  }
}
