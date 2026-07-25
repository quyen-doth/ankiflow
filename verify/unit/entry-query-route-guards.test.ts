import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const { addedEntries, updatedEntries, existingEntry } = vi.hoisted(() => ({
  addedEntries: [] as Record<string, unknown>[],
  updatedEntries: [] as Record<string, unknown>[],
  existingEntry: {
    user_id: 'uid-1',
    word: 'Old',
    card_type_ids: ['ct-old'],
  } as Record<string, unknown>,
}))

vi.mock('@/lib/auth-guard', () => ({
  withAuth: (
    handler: (request: Request, context: unknown, uid: string) => Promise<Response>,
  ) => (request: Request, context: unknown) => handler(request, context, 'uid-1'),
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminDb: () => ({
    collection: () => ({
      add: async (data: Record<string, unknown>) => {
        addedEntries.push(data)
        return { id: 'new-entry' }
      },
      doc: (id: string) => ({
        id,
        get: async () => ({
          id,
          exists: true,
          data: () => ({ ...existingEntry }),
        }),
        update: async (data: Record<string, unknown>) => {
          updatedEntries.push(data)
        },
      }),
    }),
  }),
}))

import { POST as saveEntry } from '@/app/api/entries/save/route'
import {
  POST as createHistoryEntry,
} from '@/app/api/history/route'
import {
  PUT as updateHistoryEntry,
} from '@/app/api/history/[id]/route'
import { PUT as updateAnkiEntry } from '@/app/api/anki/update/route'

function request(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const historyContext = { params: Promise.resolve({ id: 'entry-1' }) }

beforeEach(() => {
  addedEntries.length = 0
  updatedEntries.length = 0
})

describe('Entry mutation route query metadata guards', () => {
  it('save/history create payload の reserved prefix を明示的に拒否する', async () => {
    const saveResponse = await saveEntry(request(
      'http://localhost/api/entries/save',
      'POST',
      { entryData: { word: 'Unsafe', _query_future: 'user value' } },
    ), historyContext)
    const historyResponse = await createHistoryEntry(request(
      'http://localhost/api/history',
      'POST',
      { word: 'Unsafe', _query_duplicate_key: 'spoofed' },
    ), historyContext)

    expect(saveResponse.status).toBe(400)
    expect(historyResponse.status).toBe(400)
    expect(await saveResponse.json()).toMatchObject({
      error: expect.stringContaining('server-managed'),
    })
    expect(addedEntries).toEqual([])
  })

  it('History/Anki update payload の reserved prefix を明示的に拒否する', async () => {
    const historyResponse = await updateHistoryEntry(request(
      'http://localhost/api/history/entry-1',
      'PUT',
      { _query_card_count: 999 },
    ), historyContext)
    const ankiResponse = await updateAnkiEntry(request(
      'http://localhost/api/anki/update',
      'PUT',
      { entryId: 'entry-1', updates: { _query_schema_version: 999 } },
    ), historyContext)

    expect(historyResponse.status).toBe(400)
    expect(ankiResponse.status).toBe(400)
    expect(updatedEntries).toEqual([])
  })

  it('create と partial update で metadata を server-side recompute する', async () => {
    const createResponse = await saveEntry(request(
      'http://localhost/api/entries/save',
      'POST',
      { entryData: { word: '  Docker  ', card_type_ids: ['a', 'b'] } },
    ), historyContext)
    const updateResponse = await updateHistoryEntry(request(
      'http://localhost/api/history/entry-1',
      'PUT',
      { word: 'Kubernetes', card_type_ids: ['a', 'b', 'c'] },
    ), historyContext)

    expect(createResponse.status).toBe(200)
    expect(updateResponse.status).toBe(200)
    expect(addedEntries[0]).toMatchObject({
      _query_schema_version: 1,
      _query_duplicate_key: 'docker',
      _query_card_count: 2,
    })
    expect(updatedEntries[0]).toMatchObject({
      _query_schema_version: 1,
      _query_duplicate_key: 'kubernetes',
      _query_card_count: 3,
    })
  })
})
