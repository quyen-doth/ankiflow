import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Firestore } from 'firebase-admin/firestore'
import { describe, expect, it } from 'vitest'
import { FormType } from '@/types'
import {
  InvalidHistoryCursorError,
  loadHistoryFacets,
  loadHistoryPage,
  parseHistoryListParams,
} from '@/lib/history/historyQuery'

interface FakeEntry {
  id: string
  data: Record<string, unknown>
}

interface QueryLog {
  kind: 'documents' | 'count'
  filters: Array<[string, string, unknown]>
  projection: string[]
  limit?: number
  startAfter: unknown[]
  orderBy: Array<[unknown, unknown]>
}

interface QueryState {
  filters: QueryLog['filters']
  projection: string[]
  limit?: number
  startAfter: unknown[]
  orderBy: QueryLog['orderBy']
}

function timestamp(seconds: number, nanoseconds = 0) {
  return {
    seconds,
    nanoseconds,
    toDate: () => new Date(seconds * 1_000 + Math.floor(nanoseconds / 1_000_000)),
  }
}

function timestampParts(value: unknown): { seconds: number; nanoseconds: number } {
  return value as { seconds: number; nanoseconds: number }
}

function fakeDb(entries: FakeEntry[], logs: QueryLog[]): Firestore {
  const applyFilters = (state: QueryState) => entries.filter(entry => (
    state.filters.every(([field, operator, expected]) => {
      const actual = entry.data[field]
      if (operator === '==') return actual === expected
      if (operator === 'in') {
        return Array.isArray(expected) && expected.includes(actual)
      }
      throw new Error(`Unsupported fake operator: ${operator}`)
    })
  ))

  const sorted = (state: QueryState, source: FakeEntry[]) => {
    if (state.orderBy.length === 0) return source
    return [...source].sort((left, right) => {
      const leftTimestamp = timestampParts(left.data.created_at)
      const rightTimestamp = timestampParts(right.data.created_at)
      if (leftTimestamp.seconds !== rightTimestamp.seconds) {
        return rightTimestamp.seconds - leftTimestamp.seconds
      }
      if (leftTimestamp.nanoseconds !== rightTimestamp.nanoseconds) {
        return rightTimestamp.nanoseconds - leftTimestamp.nanoseconds
      }
      return right.id.localeCompare(left.id)
    })
  }

  const afterCursor = (state: QueryState, source: FakeEntry[]) => {
    if (state.startAfter.length === 0) return source
    const cursorTimestamp = timestampParts(state.startAfter[0])
    const cursorId = state.startAfter[1]
    return source.filter(entry => {
      const createdAt = timestampParts(entry.data.created_at)
      if (createdAt.seconds !== cursorTimestamp.seconds) {
        return createdAt.seconds < cursorTimestamp.seconds
      }
      if (createdAt.nanoseconds !== cursorTimestamp.nanoseconds) {
        return createdAt.nanoseconds < cursorTimestamp.nanoseconds
      }
      return typeof cursorId === 'string' && entry.id < cursorId
    })
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
      startAfter: (...values: unknown[]) => makeQuery({
        ...state,
        startAfter: values,
      }),
      count: () => ({
        get: async () => {
          logs.push({
            kind: 'count',
            filters: state.filters,
            projection: [],
            startAfter: [],
            orderBy: [],
          })
          return { data: () => ({ count: applyFilters(state).length }) }
        },
      }),
      get: async () => {
        logs.push({
          kind: 'documents',
          filters: state.filters,
          projection: state.projection,
          ...(typeof state.limit === 'number' ? { limit: state.limit } : {}),
          startAfter: state.startAfter,
          orderBy: state.orderBy,
        })
        const matching = afterCursor(state, sorted(state, applyFilters(state)))
        const limited = typeof state.limit === 'number'
          ? matching.slice(0, state.limit)
          : matching
        return {
          docs: limited.map(entry => ({
            id: entry.id,
            data: () => state.projection.length === 0
              ? entry.data
              : Object.fromEntries(
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
      if (name !== 'entries') throw new Error(`Unexpected collection: ${name}`)
      return makeQuery({
        filters: [],
        projection: [],
        startAfter: [],
        orderBy: [],
      })
    },
  } as unknown as Firestore
}

function makeEntries(count: number): FakeEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `entry-${String(index).padStart(3, '0')}`,
    data: {
      user_id: 'uid-1',
      form_type: index % 2 === 0 ? FormType.LANGUAGE : FormType.IT,
      language: index % 2 === 0 ? 'en' : undefined,
      word: `Word ${index}`,
      meaning_vi: `Meaning ${index}`,
      anki_deck: 'Default',
      anki_note_ids: [index + 1],
      card_type_ids: ['front', 'back'],
      _query_card_count: 2,
      status: index % 3 === 0 ? 'synced' : 'draft',
      created_at: timestamp(10_000 - index),
      audio_url: 'data:audio/large',
      image_url: 'data:image/large',
    },
  }))
}

describe('History query parameters', () => {
  it('query params を検証・正規化し、不正な language/limit を拒否する', () => {
    const parsed = parseHistoryListParams(new URL(
      'https://example.test/api/history?limit=25&form_type=language'
      + '&language=ja_JP&status=reviewed&keyword=%20event%20',
    ))

    expect(parsed).toEqual({
      success: true,
      data: {
        pageSize: 25,
        formType: 'language',
        language: 'ja-JP',
        status: 'reviewed',
        keyword: 'event',
      },
    })
    expect(parseHistoryListParams(new URL(
      'https://example.test/api/history?language=en',
    ))).toEqual({ success: false })
    expect(parseHistoryListParams(new URL(
      'https://example.test/api/history?limit=101',
    ))).toEqual({ success: false })
  })
})

describe('History paginated query', () => {
  it('initial path は UID scope・summary projection・pageSize+1・stable cursor を使う', async () => {
    const logs: QueryLog[] = []
    const entries = [
      ...makeEntries(52),
      {
        id: 'other-user-entry',
        data: {
          ...makeEntries(1)[0].data,
          user_id: 'uid-other',
          created_at: timestamp(20_000),
        },
      },
    ]
    const db = fakeDb(entries, logs)

    const first = await loadHistoryPage(db, 'uid-1', { pageSize: 50 })

    expect(first.entries).toHaveLength(50)
    expect(first.total).toBe(52)
    expect(first.next_cursor).toEqual(expect.any(String))
    expect(first.entries[0]).toEqual(expect.objectContaining({
      id: 'entry-000',
      card_count: 2,
      created_at: '1970-01-01T02:46:40.000Z',
    }))
    expect(first.entries[0]).not.toHaveProperty('audio_url')
    expect(first.entries[0]).not.toHaveProperty('image_url')
    const pageLog = logs.find(log => log.kind === 'documents')
    expect(pageLog?.filters[0]).toEqual(['user_id', '==', 'uid-1'])
    expect(pageLog?.limit).toBe(51)
    expect(pageLog?.projection).toContain('created_at')
    expect(pageLog?.projection).not.toContain('audio_url')
    expect(pageLog?.projection).not.toContain('image_url')
    expect(pageLog?.orderBy).toHaveLength(2)
    expect(pageLog?.orderBy.map(([, direction]) => direction))
      .toEqual(['desc', 'desc'])

    const second = await loadHistoryPage(db, 'uid-1', {
      pageSize: 50,
      cursor: first.next_cursor ?? undefined,
    })

    expect(second.entries.map(entry => entry.id)).toEqual(['entry-050', 'entry-051'])
    expect(second.next_cursor).toBeNull()
    expect(logs.filter(log => log.kind === 'documents').at(-1)?.startAfter)
      .toHaveLength(2)
  })

  it('cursor を filter scope に bind し、別条件での再利用を拒否する', async () => {
    const logs: QueryLog[] = []
    const db = fakeDb(makeEntries(3), logs)
    const first = await loadHistoryPage(db, 'uid-1', { pageSize: 1 })
    const logCount = logs.length

    await expect(loadHistoryPage(db, 'uid-1', {
      pageSize: 1,
      status: 'draft',
      cursor: first.next_cursor ?? undefined,
    })).rejects.toBeInstanceOf(InvalidHistoryCursorError)
    expect(logs).toHaveLength(logCount)
  })

  it('Content Type/language/status を Firestore filter に移し legacy route を正規化する', async () => {
    const logs: QueryLog[] = []
    const db = fakeDb([
      {
        id: 'legacy-language',
        data: {
          ...makeEntries(1)[0].data,
          form_type: 'language',
          language: 'en',
          status: 'reviewed',
          category_id: 'category-1',
        },
      },
    ], logs)

    const result = await loadHistoryPage(db, 'uid-1', {
      pageSize: 10,
      formType: FormType.LANGUAGE,
      language: 'en',
      status: 'reviewed',
      categoryId: 'category-1',
    })

    expect(result.entries[0].form_type).toBe(FormType.LANGUAGE)
    const filters = logs.find(log => log.kind === 'documents')?.filters
    expect(filters).toContainEqual(['form_type', 'in', [FormType.LANGUAGE, 'language']])
    expect(filters).toContainEqual(['language', '==', 'en'])
    expect(filters).toContainEqual(['status', '==', 'reviewed'])
    expect(filters).toContainEqual(['category_id', '==', 'category-1'])
  })

  it('category_id の全 supported filter combination に composite index を宣言する', () => {
    const config = JSON.parse(readFileSync(
      join(process.cwd(), 'firestore.indexes.json'),
      'utf8',
    )) as {
      indexes: Array<{ fields: Array<{ fieldPath: string }> }>
    }
    const declared = new Set(config.indexes.map(index => (
      index.fields.map(field => field.fieldPath).join(',')
    )))
    const categoryShapes = [
      'user_id,category_id,created_at',
      'user_id,category_id,status,created_at',
      'user_id,category_id,form_type,created_at',
      'user_id,category_id,form_type,status,created_at',
      'user_id,category_id,form_type,language,created_at',
      'user_id,category_id,form_type,language,status,created_at',
    ]

    for (const shape of categoryShapes) expect(declared).toContain(shape)
  })
})

describe('History keyword and facets fallback', () => {
  it('keyword path のみ projected O(n) scan を行い substring semantics と cursor を保つ', async () => {
    const logs: QueryLog[] = []
    const base = makeEntries(3)
    base[0].data.word = 'Alpha'
    base[1].data.word = 'Beta'
    base[1].data.meaning_vi = 'contains ALPHA here'
    base[2].data.word = 'Gamma'
    const db = fakeDb(base, logs)

    const first = await loadHistoryPage(db, 'uid-1', {
      pageSize: 1,
      keyword: 'alpha',
    })

    expect(first.entries.map(entry => entry.id)).toEqual(['entry-000'])
    expect(first.total).toBe(2)
    expect(first.next_cursor).toEqual(expect.any(String))
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      kind: 'documents',
      filters: [['user_id', '==', 'uid-1']],
    })
    expect(logs[0].limit).toBeUndefined()
    expect(logs[0].projection).not.toContain('audio_url')

    const second = await loadHistoryPage(db, 'uid-1', {
      pageSize: 1,
      keyword: 'alpha',
      cursor: first.next_cursor ?? undefined,
    })
    expect(second.entries.map(entry => entry.id)).toEqual(['entry-001'])
    expect(second.next_cursor).toBeNull()
  })

  it('facets は UID-scoped form_type/language projection のみを読む', async () => {
    const logs: QueryLog[] = []
    const db = fakeDb([
      {
        id: 'legacy-language',
        data: {
          user_id: 'uid-1',
          form_type: 'language',
          language: 'ja_JP',
          created_at: timestamp(2),
        },
      },
      {
        id: 'it-with-unused-language',
        data: {
          user_id: 'uid-1',
          form_type: FormType.IT,
          language: 'de',
          created_at: timestamp(1),
        },
      },
      {
        id: 'other-user',
        data: {
          user_id: 'uid-other',
          form_type: FormType.GENERAL,
          language: 'fr',
          created_at: timestamp(3),
        },
      },
    ], logs)

    await expect(loadHistoryFacets(db, 'uid-1')).resolves.toEqual({
      form_types: [FormType.IT, FormType.LANGUAGE],
      languages: ['ja-JP'],
    })
    expect(logs).toEqual([{
      kind: 'documents',
      filters: [['user_id', '==', 'uid-1']],
      projection: ['form_type', 'language'],
      startAfter: [],
      orderBy: [],
    }])
  })
})
