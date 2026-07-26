import type { Firestore } from 'firebase-admin/firestore'
import { describe, expect, it } from 'vitest'
import {
  DUPLICATE_LOOKUP_IN_LIMIT,
  lookupEntryDuplicates,
} from '@/lib/entries/duplicateLookup'

interface FakeEntry {
  id: string
  data: Record<string, unknown>
}

interface QueryLog {
  filters: Array<[string, string, unknown]>
  projection: string[]
}

function fakeDb(options: {
  ready: boolean
  entries: FakeEntry[]
  queryLogs: QueryLog[]
}): Firestore {
  return {
    collection: (name: string) => {
      if (name === 'settings') {
        return {
          doc: () => ({
            get: async () => ({
              data: () => options.ready ? { entry_query_schema_version: 1 } : {},
            }),
          }),
        }
      }

      const filters: QueryLog['filters'] = []
      let projection: string[] = []
      const query = {
        where: (field: string, operator: string, value: unknown) => {
          filters.push([field, operator, value])
          return query
        },
        select: (...fields: string[]) => {
          projection = fields
          return query
        },
        get: async () => {
          options.queryLogs.push({
            filters: filters.map(filter => [...filter]),
            projection: [...projection],
          })
          const inFilter = filters.find(filter => filter[1] === 'in')
          const values = new Set(Array.isArray(inFilter?.[2]) ? inFilter[2] : [])
          const docs = options.entries
            .filter(entry => (
              !inFilter || values.has(entry.data._query_duplicate_key)
            ))
            .map(entry => ({
              id: entry.id,
              data: () => Object.fromEntries(
                projection.map(field => [field, entry.data[field]]),
              ),
            }))
          return { docs }
        },
      }
      return query
    },
  } as unknown as Firestore
}

describe('Entry duplicate lookup', () => {
  it('ready marker 後は normalized target を dedupe/chunk して indexed projection を使う', async () => {
    const queryLogs: QueryLog[] = []
    const targets = Array.from(
      { length: DUPLICATE_LOOKUP_IN_LIMIT + 1 },
      (_, index) => `Word-${index}`,
    )
    targets.push('  WORD-0  ')
    const db = fakeDb({
      ready: true,
      queryLogs,
      entries: [
        {
          id: 'entry-0',
          data: {
            _query_duplicate_key: 'word-0',
            word: 'Word-0',
            anki_deck: 'Default',
            status: 'reviewed',
            created_at: { toDate: () => new Date('2026-07-25T00:00:00.000Z') },
            audio_url: 'data:audio/large',
          },
        },
        {
          id: 'entry-30',
          data: {
            _query_duplicate_key: 'word-30',
            term: 'Word-30',
            anki_deck: 'IT',
            status: 'draft',
          },
        },
      ],
    })

    const results = await lookupEntryDuplicates(db, 'uid-1', targets)

    expect(queryLogs).toHaveLength(2)
    expect(queryLogs.map(log => (
      (log.filters.find(filter => filter[1] === 'in')?.[2] as string[]).length
    ))).toEqual([30, 1])
    for (const log of queryLogs) {
      expect(log.filters[0]).toEqual(['user_id', '==', 'uid-1'])
      expect(log.filters[1][0]).toBe('_query_duplicate_key')
      expect(log.projection).toContain('_query_duplicate_key')
      expect(log.projection).not.toContain('audio_url')
    }
    expect(results).toHaveLength(targets.length)
    expect(results[0].duplicates[0]).toEqual({
      id: 'entry-0',
      word: 'Word-0',
      anki_deck: 'Default',
      status: 'reviewed',
      created_at: '2026-07-25T00:00:00.000Z',
    })
    expect(results.at(-1)).toMatchObject({
      word: 'WORD-0',
      duplicates: [expect.objectContaining({ id: 'entry-0' })],
    })
  })

  it('marker 前は user-scoped projected scan で legacy primary fields を照合する', async () => {
    const queryLogs: QueryLog[] = []
    const db = fakeDb({
      ready: false,
      queryLogs,
      entries: [{
        id: 'legacy',
        data: {
          term: '  Kubernetes ',
          anki_deck: 'Vocabulary::IT',
          status: 'synced',
          image_url: 'data:image/large',
        },
      }],
    })

    const results = await lookupEntryDuplicates(db, 'uid-legacy', ['kubernetes', 'new'])

    expect(queryLogs).toEqual([{
      filters: [['user_id', '==', 'uid-legacy']],
      projection: ['word', 'term', 'title', 'anki_deck', 'status', 'created_at'],
    }])
    expect(results[0].duplicates).toEqual([expect.objectContaining({
      id: 'legacy',
      word: '  Kubernetes ',
    })])
    expect(results[1].duplicates).toEqual([])
  })

  it('空 target では marker/documents を読まない', async () => {
    const queryLogs: QueryLog[] = []
    const db = fakeDb({ ready: true, queryLogs, entries: [] })

    await expect(lookupEntryDuplicates(db, 'uid-1', [' ', '']))
      .resolves.toEqual([])
    expect(queryLogs).toEqual([])
  })
})
