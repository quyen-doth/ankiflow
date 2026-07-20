import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReviewState } from '@/types'

/**
 * POST /api/anki/sync-srs — precedence guard + review_events (SRS Phase 0).
 *
 * 検証用コメント。
 * 検証用コメント。
 */

interface EntryDoc {
  id: string
  data: Record<string, unknown>
}

const { verifyMock, entryDocs, updates, creates } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  entryDocs: [] as EntryDoc[],
  updates: [] as { ref: { col: string; id: string }; data: Record<string, unknown> }[],
  creates: [] as { ref: { col: string; id: string }; data: Record<string, unknown> }[],
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuthInstance: () => ({ verifySessionCookie: verifyMock }),
  getAdminDb: () => ({
    collection: (name: string) => ({
      // query GET entries synced (2 where lồng nhau rồi get)
      where: () => ({
        where: () => ({
          get: async () => ({
            docs: entryDocs.map((e) => ({ id: e.id, data: () => e.data })),
            empty: entryDocs.length === 0,
          }),
        }),
      }),
      doc: (id?: string) => ({ col: name, id: id ?? `auto-${creates.length}` }),
    }),
    batch: () => ({
      update: (ref: { col: string; id: string }, data: Record<string, unknown>) => updates.push({ ref, data }),
      set: (ref: { col: string; id: string }, data: Record<string, unknown>) => creates.push({ ref, data }),
      commit: async () => {},
    }),
  }),
}))

import { POST } from '@/app/api/anki/sync-srs/route'

const T_OLD = '2026-07-01T00:00:00.000Z' // 1751328000000 ms
const T_NEW = '2026-07-06T00:00:00.000Z' // 1751760000000 ms
const MOD_BETWEEN = Math.floor(new Date('2026-07-03T00:00:00Z').getTime() / 1000)
const MOD_LATEST = Math.floor(new Date('2026-07-07T00:00:00Z').getTime() / 1000)

function builtinState(overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    ease_factor: 2.5,
    interval_days: 3,
    due_date: '2026-07-08T00:00:00.000Z',
    lapses: 1,
    total_reviews: 4,
    last_reviewed_at: T_NEW,
    last_rating: 'good',
    queue: 'review',
    learning_step: 0,
    source: 'builtin',
    synced_at: T_OLD,
    ...overrides,
  }
}

function makeCard(overrides: Record<string, unknown> = {}) {
  return { noteId: 100, interval: 10, ease: 2600, due: 1752000000, lapses: 2, queue: 2, ...overrides }
}

function makeReq(cards: unknown[]) {
  return new Request('http://localhost:3000/api/anki/sync-srs', {
    method: 'POST',
    headers: { cookie: '__session=ok', 'Content-Type': 'application/json' },
    body: JSON.stringify({ cards }),
  })
}

async function callPost(cards: unknown[]) {
  // 検証用コメント。
  const res = await (POST as unknown as (req: Request) => Promise<Response>)(makeReq(cards))
  return { status: res.status, body: await res.json() }
}

beforeEach(() => {
  verifyMock.mockReset()
  verifyMock.mockResolvedValue({ uid: 'u1', email: 'user@test.dev' })
  entryDocs.length = 0
  updates.length = 0
  creates.length = 0
})

describe('POST /api/anki/sync-srs — precedence guard', () => {
  it('Anki mod が builtin rating より新しい → Anki が勝つ: update + event anki_sync', async () => {
    entryDocs.push({ id: 'e1', data: { anki_note_ids: [100], review_state: builtinState() } })

    const { body } = await callPost([makeCard({ mod: MOD_LATEST })])

    expect(body).toMatchObject({ success: true, synced: 1, skipped: 0, total: 1 })
    expect(updates).toHaveLength(1)
    expect(updates[0].ref).toEqual({ col: 'entries', id: 'e1' })
    expect(creates).toHaveLength(1)
    expect(creates[0].ref.col).toBe('review_events')
    expect(creates[0].data).toMatchObject({
      user_id: 'u1',
      entry_id: 'e1',
      kind: 'anki_sync',
      prev: { interval_days: 3, lapses: 1 },
      next: { interval_days: 10, lapses: 2 },
    })
  })

  it('builtin rating が Anki mod より新しい → SKIP: update なし、event なし', async () => {
    entryDocs.push({ id: 'e1', data: { anki_note_ids: [100], review_state: builtinState() } })

    const { body } = await callPost([makeCard({ mod: MOD_BETWEEN })])

    expect(body).toMatchObject({ success: true, synced: 0, skipped: 1, total: 1 })
    expect(updates).toHaveLength(0)
    expect(creates).toHaveLength(0)
  })

  it('mod がない (古い AnkiConnect) + synced_at より後に rated → SKIP (LINE の進捗保持を優先)', async () => {
    entryDocs.push({ id: 'e1', data: { anki_note_ids: [100], review_state: builtinState() } })

    const { body } = await callPost([makeCard()])

    expect(body).toMatchObject({ synced: 0, skipped: 1 })
    expect(updates).toHaveLength(0)
  })

  it('mod がない + 未 sync (synced_at が空) → SKIP', async () => {
    entryDocs.push({
      id: 'e1',
      data: { anki_note_ids: [100], review_state: builtinState({ synced_at: '' }) },
    })

    const { body } = await callPost([makeCard()])
    expect(body).toMatchObject({ synced: 0, skipped: 1 })
  })

  it('source が anki_sync (LINE で rate されていない) → 常に上書き (旧来通り)', async () => {
    entryDocs.push({
      id: 'e1',
      data: { anki_note_ids: [100], review_state: builtinState({ source: 'anki_sync' }) },
    })

    const { body } = await callPost([makeCard({ mod: MOD_BETWEEN })])
    expect(body).toMatchObject({ synced: 1, skipped: 0 })
    expect(updates).toHaveLength(1)
  })

  it('entry に review_state がない → update + prev null の event', async () => {
    entryDocs.push({ id: 'e1', data: { anki_note_ids: [100] } })

    await callPost([makeCard({ mod: MOD_LATEST })])

    expect(updates).toHaveLength(1)
    expect(creates[0].data).toMatchObject({ kind: 'anki_sync', prev: null })
  })
})

describe('POST /api/anki/sync-srs — revlog は state が変化したときのみ記録', () => {
  it('state が変化しない → update (synced_at を更新) するが event なし', async () => {
    // 検証用コメント。
    const due = 1752000000
    entryDocs.push({
      id: 'e1',
      data: {
        anki_note_ids: [100],
        review_state: builtinState({
          source: 'anki_sync', // 検証用コメント。
          interval_days: 10,
          lapses: 2,
          queue: 'review',
          due_date: new Date(due * 1000).toISOString(),
        }),
      },
    })

    const { body } = await callPost([makeCard({ due })])

    expect(body).toMatchObject({ synced: 1 })
    expect(updates).toHaveLength(1)
    expect(creates).toHaveLength(0)
  })
})

describe('POST /api/anki/sync-srs — mapping の損失を軽減', () => {
  it('total_reviews は Anki の reps があればそこから取得', async () => {
    entryDocs.push({ id: 'e1', data: { anki_note_ids: [100] } })

    await callPost([makeCard({ reps: 42 })])

    const state = updates[0].data.review_state as ReviewState
    expect(state.total_reviews).toBe(42)
    expect(state.source).toBe('anki_sync')
  })

  it('reps がない → total_reviews = 0 (旧来通り)', async () => {
    entryDocs.push({ id: 'e1', data: { anki_note_ids: [100] } })
    await callPost([makeCard()])
    expect((updates[0].data.review_state as ReviewState).total_reviews).toBe(0)
  })
})
