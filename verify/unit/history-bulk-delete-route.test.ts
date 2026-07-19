import { beforeEach, describe, expect, it, vi } from 'vitest'

interface MockRef {
  collection: string
  id: string
  get: () => Promise<MockSnapshot>
}

interface MockSnapshot {
  exists: boolean
  data: () => Record<string, unknown> | undefined
}

const { verifyMock, entryDocs, deletes, sets, commits } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  entryDocs: new Map<string, Record<string, unknown>>(),
  deletes: [] as Array<{ collection: string; id: string }>,
  sets: [] as Array<{
    ref: { collection: string; id: string }
    data: Record<string, unknown>
    options: { merge: boolean }
  }>,
  commits: { count: 0 },
}))

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    arrayUnion: (...values: unknown[]) => ({ operation: 'arrayUnion', values }),
  },
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuthInstance: () => ({ verifySessionCookie: verifyMock }),
  getAdminDb: () => ({
    collection: (collection: string) => ({
      doc: (id: string): MockRef => ({
        collection,
        id,
        get: async () => {
          const data = collection === 'entries' ? entryDocs.get(id) : undefined
          return { exists: !!data, data: () => data }
        },
      }),
    }),
    batch: () => ({
      delete: (ref: MockRef) => deletes.push({ collection: ref.collection, id: ref.id }),
      set: (
        ref: MockRef,
        data: Record<string, unknown>,
        options: { merge: boolean },
      ) => sets.push({ ref, data, options }),
      commit: async () => { commits.count += 1 },
    }),
  }),
}))

import { POST } from '@/app/api/history/bulk-delete/route'

const ROUTE_CONTEXT = { params: Promise.resolve({}) }

function request(body: unknown): Request {
  return new Request('http://localhost:3000/api/history/bulk-delete', {
    method: 'POST',
    headers: { cookie: '__session=ok', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function post(body: unknown) {
  const response = await POST(request(body), ROUTE_CONTEXT)
  return { status: response.status, body: await response.json() }
}

beforeEach(() => {
  verifyMock.mockReset()
  verifyMock.mockResolvedValue({ uid: 'user-1', email: 'user@example.com' })
  entryDocs.clear()
  deletes.length = 0
  sets.length = 0
  commits.count = 0
})

describe('POST /api/history/bulk-delete', () => {
  it('認証 user 所有の entry だけを削除し、他 user と存在しない ID を skip する', async () => {
    entryDocs.set('owned', { user_id: 'user-1', anki_note_ids: [11] })
    entryDocs.set('foreign', { user_id: 'user-2', anki_note_ids: [22] })

    const result = await post({
      ids: ['owned', 'foreign', 'missing'],
      anki_cleaned: true,
    })

    expect(result).toEqual({
      status: 200,
      body: { deleted: 1, skipped: 2, queued_note_count: 0 },
    })
    expect(deletes).toEqual([{ collection: 'entries', id: 'owned' }])
    expect(sets).toHaveLength(0)
    expect(commits.count).toBe(1)
  })

  it('Anki 未処理の note ID を dedupe して settings queue に merge する', async () => {
    entryDocs.set('one', { user_id: 'user-1', anki_note_ids: [11, 12, 12] })
    entryDocs.set('two', { user_id: 'user-1', anki_note_ids: [12, 13] })

    const result = await post({ ids: ['one', 'two'], anki_cleaned: false })

    expect(result.body).toEqual({ deleted: 2, skipped: 0, queued_note_count: 3 })
    expect(sets).toEqual([{
      ref: expect.objectContaining({ collection: 'settings', id: 'user-1' }),
      data: {
        pending_anki_note_deletions: {
          operation: 'arrayUnion',
          values: [11, 12, 13],
        },
      },
      options: { merge: true },
    }])
  })

  it('Anki 処理済みの場合は settings を変更しない', async () => {
    entryDocs.set('owned', { user_id: 'user-1', anki_note_ids: [11] })

    const result = await post({ ids: ['owned'], anki_cleaned: true })

    expect(result.body.queued_note_count).toBe(0)
    expect(sets).toHaveLength(0)
  })

  it('削除対象がすべて無効でも 200 + skipped を返し、空 batch を commit しない', async () => {
    const result = await post({ ids: ['missing'], anki_cleaned: false })

    expect(result.body).toEqual({ deleted: 0, skipped: 1, queued_note_count: 0 })
    expect(commits.count).toBe(0)
  })

  it('空配列または 100 件超の body は 400', async () => {
    const empty = await post({ ids: [], anki_cleaned: false })
    const tooMany = await post({
      ids: Array.from({ length: 101 }, (_, index) => `entry-${index}`),
      anki_cleaned: false,
    })

    expect(empty.status).toBe(400)
    expect(tooMany.status).toBe(400)
    expect(deletes).toHaveLength(0)
  })
})
