import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Firestore } from 'firebase-admin/firestore'
import { describe, expect, it } from 'vitest'
import { FormType } from '@/types'
import {
  DASHBOARD_RECENT_LIMIT,
  loadDashboard,
  parseDashboardQueryParams,
} from '@/lib/dashboard/dashboardQuery'

interface FakeEntry {
  id: string
  data: Record<string, unknown>
}

interface QueryLog {
  kind: 'settings' | 'documents' | 'count' | 'aggregate'
  filters: Array<[string, string, unknown]>
  projection: string[]
  orderBy: Array<[unknown, unknown]>
  aggregateKeys: string[]
  limit?: number
}

interface QueryState {
  filters: QueryLog['filters']
  projection: string[]
  orderBy: QueryLog['orderBy']
  limit?: number
}

function timestamp(iso: string) {
  const date = new Date(iso)
  return {
    seconds: Math.floor(date.getTime() / 1_000),
    nanoseconds: date.getMilliseconds() * 1_000_000,
    toDate: () => date,
  }
}

function valueMillis(value: unknown): number {
  if (!value || typeof value !== 'object') return Number.NaN
  const toDate = (value as { toDate?: () => unknown }).toDate
  const date = typeof toDate === 'function' ? toDate.call(value) : null
  return date instanceof Date ? date.getTime() : Number.NaN
}

function fakeDb(options: {
  ready: boolean
  entries: FakeEntry[]
  logs: QueryLog[]
}): Firestore {
  const applyFilters = (state: QueryState) => options.entries.filter(entry => (
    state.filters.every(([field, operator, expected]) => {
      const actual = entry.data[field]
      if (operator === '==') return actual === expected
      if (operator === 'in') {
        return Array.isArray(expected) && expected.includes(actual)
      }
      if (operator === '>=') return valueMillis(actual) >= valueMillis(expected)
      if (operator === '<') return valueMillis(actual) < valueMillis(expected)
      throw new Error(`Unsupported fake operator: ${operator}`)
    })
  ))

  const sorted = (state: QueryState, entries: FakeEntry[]) => {
    if (state.orderBy.length === 0) return entries
    return [...entries].sort((left, right) => (
      valueMillis(right.data.created_at) - valueMillis(left.data.created_at)
      || right.id.localeCompare(left.id)
    ))
  }

  const makeQuery = (state: QueryState) => {
    const query = {
      where: (field: string, operator: string, value: unknown) => makeQuery({
        ...state,
        filters: [...state.filters, [field, operator, value]],
      }),
      select: (...fields: string[]) => makeQuery({
        ...state,
        projection: fields,
      }),
      orderBy: (field: unknown, direction: unknown) => makeQuery({
        ...state,
        orderBy: [...state.orderBy, [field, direction]],
      }),
      limit: (value: number) => makeQuery({ ...state, limit: value }),
      count: () => ({
        get: async () => {
          options.logs.push({
            kind: 'count',
            filters: state.filters,
            projection: [],
            orderBy: [],
            aggregateKeys: [],
          })
          return { data: () => ({ count: applyFilters(state).length }) }
        },
      }),
      aggregate: (fields: Record<string, unknown>) => ({
        get: async () => {
          const matching = applyFilters(state)
          options.logs.push({
            kind: 'aggregate',
            filters: state.filters,
            projection: [],
            orderBy: [],
            aggregateKeys: Object.keys(fields),
          })
          return {
            data: () => ({
              total_vocabulary: matching.length,
              total_cards: matching.reduce((sum, entry) => (
                sum + (typeof entry.data._query_card_count === 'number'
                  ? entry.data._query_card_count
                  : 0)
              ), 0),
            }),
          }
        },
      }),
      get: async () => {
        options.logs.push({
          kind: 'documents',
          filters: state.filters,
          projection: state.projection,
          orderBy: state.orderBy,
          aggregateKeys: [],
          ...(typeof state.limit === 'number' ? { limit: state.limit } : {}),
        })
        const matching = sorted(state, applyFilters(state))
        const limited = typeof state.limit === 'number'
          ? matching.slice(0, state.limit)
          : matching
        return {
          docs: limited.map(entry => ({
            id: entry.id,
            data: () => Object.fromEntries(
              state.projection.map(field => [field, entry.data[field]]),
            ),
          })),
        }
      },
    }
    return query
  }

  return {
    collection: (name: string) => {
      if (name === 'settings') {
        return {
          doc: () => ({
            get: async () => {
              options.logs.push({
                kind: 'settings',
                filters: [],
                projection: [],
                orderBy: [],
                aggregateKeys: [],
              })
              return {
                data: () => options.ready ? { entry_query_schema_version: 1 } : {},
              }
            },
          }),
        }
      }
      if (name !== 'entries') throw new Error(`Unexpected collection: ${name}`)
      return makeQuery({
        filters: [],
        projection: [],
        orderBy: [],
      })
    },
  } as unknown as Firestore
}

function entry(
  id: string,
  overrides: Record<string, unknown> = {},
): FakeEntry {
  return {
    id,
    data: {
      user_id: 'uid-1',
      form_type: FormType.LANGUAGE,
      language: 'en',
      word: id,
      meaning_vi: `${id} meaning`,
      status: 'draft',
      created_at: timestamp('2026-07-25T00:00:00.000Z'),
      card_type_ids: ['front'],
      _query_card_count: 1,
      audio_url: 'data:audio/large',
      image_url: 'data:image/large',
      ...overrides,
    },
  }
}

const QUERY_PARAMS = {
  dayStart: new Date('2026-07-26T00:00:00.000Z'),
  dayEnd: new Date('2026-07-27T00:00:00.000Z'),
  languages: ['en', 'ja'],
}

describe('Dashboard query parameters', () => {
  it('23/25 時間の local-day bounds を受け入れ、language を canonicalize/dedupe する', () => {
    const spring = parseDashboardQueryParams(new URL(
      'https://example.test/api/dashboard'
      + '?day_start=2026-03-08T05%3A00%3A00.000Z'
      + '&day_end=2026-03-09T04%3A00%3A00.000Z'
      + '&language=ja_JP&language=ja-JP&language=en',
    ))
    const fall = parseDashboardQueryParams(new URL(
      'https://example.test/api/dashboard'
      + '?day_start=2026-11-01T04%3A00%3A00.000Z'
      + '&day_end=2026-11-02T05%3A00%3A00.000Z',
    ))

    expect(spring).toEqual({
      success: true,
      data: {
        dayStart: new Date('2026-03-08T05:00:00.000Z'),
        dayEnd: new Date('2026-03-09T04:00:00.000Z'),
        languages: ['ja-JP', 'en'],
      },
    })
    expect(fall.success).toBe(true)
  })

  it('不正 timestamp・逆順・22〜26 時間外・不正 language を拒否する', () => {
    const urls = [
      'day_start=nope&day_end=2026-07-27T00%3A00%3A00.000Z',
      'day_start=2026-07-27T00%3A00%3A00.000Z&day_end=2026-07-26T00%3A00%3A00.000Z',
      'day_start=2026-07-26T00%3A00%3A00.000Z&day_end=2026-07-26T21%3A00%3A00.000Z',
      'day_start=2026-07-26T00%3A00%3A00.000Z&day_end=2026-07-27T03%3A00%3A00.000Z',
      'day_start=2026-07-26T00%3A00%3A00.000Z&day_end=2026-07-27T00%3A00%3A00.000Z&language=bad_code!',
    ]

    for (const query of urls) {
      expect(parseDashboardQueryParams(new URL(
        `https://example.test/api/dashboard?${query}`,
      ))).toEqual({ success: false })
    }
  })
})

describe('Dashboard data query', () => {
  it('ready marker 後は aggregate queries と 6 件 summary projection を使う', async () => {
    const logs: QueryLog[] = []
    const entries = [
      entry('newest', {
        status: 'synced',
        created_at: timestamp('2026-07-26T12:00:00.000Z'),
        _query_card_count: 3,
      }),
      entry('today-ja', {
        language: 'ja',
        created_at: timestamp('2026-07-26T01:00:00.000Z'),
        _query_card_count: 2,
      }),
      entry('legacy-route', {
        form_type: 'language',
        status: 'synced',
        created_at: timestamp('2026-07-25T23:59:59.000Z'),
      }),
      entry('old-ja', { language: 'ja', status: 'synced' }),
      entry('old-2'),
      entry('old-3'),
      entry('old-4'),
      entry('old-5'),
      entry('other-user', {
        user_id: 'uid-other',
        created_at: timestamp('2026-07-26T14:00:00.000Z'),
        _query_card_count: 99,
      }),
    ]
    const result = await loadDashboard(
      fakeDb({ ready: true, entries, logs }),
      'uid-1',
      QUERY_PARAMS,
    )

    expect(result.stats).toEqual({
      total_vocabulary: 8,
      total_cards: 11,
      created_today: 2,
      synced: 3,
    })
    expect(result.language_counts).toEqual([
      { language: 'en', count: 6 },
      { language: 'ja', count: 2 },
    ])
    expect(result.recent_entries).toHaveLength(DASHBOARD_RECENT_LIMIT)
    expect(result.recent_entries[0]).toMatchObject({
      id: 'newest',
      word: 'newest',
    })
    expect(result.recent_entries[0]).not.toHaveProperty('audio_url')
    const recentLog = logs.find(log => log.kind === 'documents')
    expect(recentLog?.limit).toBe(DASHBOARD_RECENT_LIMIT)
    expect(recentLog?.projection).not.toContain('audio_url')
    expect(recentLog?.projection).not.toContain('card_type_ids')
    expect(logs.filter(log => log.kind === 'documents')).toHaveLength(1)
    expect(logs.find(log => log.kind === 'aggregate')?.aggregateKeys)
      .toEqual(['total_vocabulary', 'total_cards'])
    for (const log of logs.filter(log => log.kind !== 'settings')) {
      expect(log.filters[0]).toEqual(['user_id', '==', 'uid-1'])
    }
  })

  it('marker 前は media-free projected scan で legacy stats を正確に計算する', async () => {
    const logs: QueryLog[] = []
    const entries = [
      entry('today', {
        created_at: timestamp('2026-07-26T10:00:00.000Z'),
        card_type_ids: ['a', 'b'],
        _query_card_count: undefined,
        status: 'synced',
      }),
      entry('legacy-ja', {
        form_type: 'language',
        language: 'ja',
        card_type_ids: ['a', '', 42],
        _query_card_count: undefined,
      }),
      entry('it', {
        form_type: FormType.IT,
        language: undefined,
        card_type_ids: [],
        _query_card_count: undefined,
      }),
      entry('other-user', { user_id: 'uid-other' }),
    ]
    const result = await loadDashboard(
      fakeDb({ ready: false, entries, logs }),
      'uid-1',
      QUERY_PARAMS,
    )

    expect(result.stats).toEqual({
      total_vocabulary: 3,
      total_cards: 3,
      created_today: 1,
      synced: 1,
    })
    expect(result.language_counts).toEqual([
      { language: 'en', count: 1 },
      { language: 'ja', count: 1 },
    ])
    const documentLogs = logs.filter(log => log.kind === 'documents')
    expect(documentLogs).toHaveLength(2)
    const fallbackLog = documentLogs.find(log => log.limit === undefined)
    expect(fallbackLog?.projection).toContain('card_type_ids')
    expect(fallbackLog?.projection).toContain('_query_card_count')
    expect(fallbackLog?.projection).not.toContain('audio_url')
    expect(logs.some(log => log.kind === 'aggregate')).toBe(false)
    expect(logs.some(log => log.kind === 'count')).toBe(false)
  })

  it('sum aggregation 用 composite index を宣言する', () => {
    const indexes = JSON.parse(readFileSync(
      join(process.cwd(), 'firestore.indexes.json'),
      'utf8',
    )) as {
      indexes: Array<{ fields: Array<{ fieldPath: string }> }>
    }
    expect(indexes.indexes.some(index => (
      index.fields.map(field => field.fieldPath).join(',')
        === 'user_id,_query_card_count'
    ))).toBe(true)
  })
})
