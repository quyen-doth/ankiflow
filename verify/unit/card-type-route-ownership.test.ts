import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

interface FakeEntryDocument {
  id: string
  data: Record<string, unknown>
}

const { routeState } = vi.hoisted(() => ({
  routeState: {
    entries: [] as FakeEntryDocument[],
    cardTypes: new Map<string, Record<string, unknown>>(),
  },
}))

vi.mock('@/lib/auth-guard', () => ({
  withAuth: (
    handler: (request: Request, context: unknown, uid: string) => Promise<Response>,
  ) => (request: Request, context: unknown) => handler(request, context, 'uid-1'),
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminDb: () => {
    const makeEntryQuery = (filters: Array<[string, unknown]>) => ({
      where: (field: string, operator: string, value: unknown) => {
        if (operator !== '==') throw new Error(`Unsupported operator: ${operator}`)
        return makeEntryQuery([...filters, [field, value]])
      },
      get: async () => {
        const matches = routeState.entries.filter(entry => (
          filters.every(([field, value]) => entry.data[field] === value)
        ))
        return {
          empty: matches.length === 0,
          docs: matches.map(entry => ({
            id: entry.id,
            data: () => ({ ...entry.data }),
          })),
        }
      },
    })

    return {
      collection: (name: string) => {
        if (name === 'entries') {
          return {
            ...makeEntryQuery([]),
            doc: (id: string) => ({
              id,
              get: async () => {
                const entry = routeState.entries.find(candidate => candidate.id === id)
                return {
                  id,
                  exists: Boolean(entry),
                  data: () => entry ? { ...entry.data } : undefined,
                }
              },
              update: async (updates: Record<string, unknown>) => {
                const entry = routeState.entries.find(candidate => candidate.id === id)
                if (entry) Object.assign(entry.data, updates)
              },
            }),
          }
        }

        if (name === 'card_types') {
          return {
            doc: (id: string) => ({
              get: async () => ({
                id,
                exists: routeState.cardTypes.has(id),
                data: () => routeState.cardTypes.get(id),
              }),
            }),
          }
        }

        throw new Error(`Unexpected collection: ${name}`)
      },
    }
  },
}))

import { GET as getEntriesSync } from '@/app/api/entries/sync/route'
import { PUT as updateAnkiEntry } from '@/app/api/anki/update/route'
import { POST as resyncAnkiEntries } from '@/app/api/anki/resync/route'

interface ReturnedCardType {
  id: string
  name: string
  code?: string
  template?: Record<string, unknown>
}

const CARD_TYPE_IDS = ['ct-mine', 'ct-theirs', 'ct-default']
const ROUTE_CONTEXT = { params: Promise.resolve({}) }

function seedEntry(id: string, status: 'reviewed' | 'synced') {
  routeState.entries.push({
    id,
    data: {
      user_id: 'uid-1',
      status,
      word: 'Owned entry',
      anki_deck: 'Owned deck',
      anki_note_ids: [101],
      card_type_ids: [...CARD_TYPE_IDS],
    },
  })
}

function expectOnlyOwnedCardType(cardTypes: ReturnedCardType[]) {
  expect(cardTypes).toEqual([
    {
      id: 'ct-mine',
      name: 'Mine',
      code: 'mine',
      template: { front: ['word'], back: ['meaning'] },
    },
  ])
  expect(JSON.stringify(cardTypes)).not.toContain('Their secret')
  expect(JSON.stringify(cardTypes)).not.toContain('Default secret')
}

beforeEach(() => {
  routeState.entries.length = 0
  routeState.cardTypes.clear()
  routeState.cardTypes.set('ct-mine', {
    user_id: 'uid-1',
    name: 'Mine',
    code: 'mine',
    template: { front: ['word'], back: ['meaning'] },
  })
  routeState.cardTypes.set('ct-theirs', {
    user_id: 'uid-2',
    name: 'Their secret',
    code: 'theirs',
    template: { front: ['word'], back: ['custom:their_secret'] },
  })
  routeState.cardTypes.set('ct-default', {
    user_id: '__defaults__',
    name: 'Default secret',
    code: 'default',
    template: { front: ['word'], back: ['custom:default_secret'] },
  })
})

describe('Card type ownership at API response boundaries', () => {
  it('GET /api/entries/sync は reviewed entry でも所有 card type だけを返す', async () => {
    seedEntry('entry-sync', 'reviewed')

    const response = await getEntriesSync(
      new NextRequest('http://localhost/api/entries/sync'),
      ROUTE_CONTEXT,
    )
    const body = await response.json() as {
      jobs: Array<{ cardTypes: ReturnedCardType[] }>
    }

    expect(response.status).toBe(200)
    expect(body.jobs).toHaveLength(1)
    expectOnlyOwnedCardType(body.jobs[0].cardTypes)
  })

  it('PUT /api/anki/update は note ID がある entry でも所有 card type だけを返す', async () => {
    seedEntry('entry-update', 'synced')

    const response = await updateAnkiEntry(
      new NextRequest('http://localhost/api/anki/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId: 'entry-update' }),
      }),
      ROUTE_CONTEXT,
    )
    const body = await response.json() as { cardTypes: ReturnedCardType[] }

    expect(response.status).toBe(200)
    expectOnlyOwnedCardType(body.cardTypes)
  })

  it('POST /api/anki/resync は synced entry でも所有 card type だけを返す', async () => {
    seedEntry('entry-resync', 'synced')

    const response = await resyncAnkiEntries(
      new NextRequest('http://localhost/api/anki/resync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      ROUTE_CONTEXT,
    )
    const body = await response.json() as { cardTypes: ReturnedCardType[] }

    expect(response.status).toBe(200)
    expectOnlyOwnedCardType(body.cardTypes)
  })
})
