import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReviewState } from '@/types'

/**
 * POST /api/notifications/line-webhook — rating qua LINE ghi review_state MỚI
 * kèm review_event `rating` (revlog, SRS Phase 0).
 */

const { updateMock, addMock, entryStore } = vi.hoisted(() => ({
  updateMock: vi.fn(async () => {}),
  addMock: vi.fn(async () => ({ id: 'ev1' })),
  entryStore: new Map<string, Record<string, unknown>>(),
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminDb: () => ({
    collection: (name: string) =>
      name === 'review_events'
        ? { add: addMock }
        : {
            doc: (id: string) => ({
              get: async () => ({ exists: entryStore.has(id), data: () => entryStore.get(id) }),
              update: updateMock,
            }),
          },
  }),
}))

// Bỏ qua verify chữ ký LINE — test này chỉ quan tâm side effect Firestore.
vi.mock('@/lib/line/client', () => ({
  verifySignatureAsync: async () => true,
}))

import { POST } from '@/app/api/notifications/line-webhook/route'

const ORIGINAL_SECRET = process.env.LINE_CHANNEL_SECRET

function makeReq(entryId: string, rating: string) {
  const body = {
    events: [
      {
        type: 'postback',
        replyToken: 'r1',
        postback: { data: `ankiflow:action=srs_rate&entry_id=${entryId}&rating=${rating}` },
      },
    ],
  }
  return new Request('http://localhost:3000/api/notifications/line-webhook', {
    method: 'POST',
    headers: { 'x-line-signature': 'sig', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function ankiState(): ReviewState {
  return {
    ease_factor: 2.5,
    interval_days: 3,
    due_date: '2026-07-05T00:00:00.000Z',
    lapses: 0,
    total_reviews: 7,
    last_reviewed_at: '',
    last_rating: 'good',
    queue: 'review',
    learning_step: 0,
    source: 'anki_sync',
    synced_at: '2026-07-04T00:00:00.000Z',
  }
}

beforeEach(() => {
  updateMock.mockClear()
  addMock.mockClear()
  entryStore.clear()
  process.env.LINE_CHANNEL_SECRET = 'test-secret'
})

afterEach(() => {
  process.env.LINE_CHANNEL_SECRET = ORIGINAL_SECRET
})

describe('POST /api/notifications/line-webhook — revlog', () => {
  it('有効な rating → review_state を update (source builtin) + kind rating の event を追加', async () => {
    entryStore.set('e1', { user_id: 'u9', review_state: ankiState() })

    const res = await POST(makeReq('e1', 'good'))
    expect(res.status).toBe(200)
    expect((await res.json()).processed).toBe(1)

    // review_state mới: source chuyển builtin (nền tảng precedence guard)
    expect(updateMock).toHaveBeenCalledTimes(1)
    const newState = updateMock.mock.calls[0][0].review_state as ReviewState
    expect(newState.source).toBe('builtin')
    expect(newState.total_reviews).toBe(8)

    // event revlog: đúng user, prev = snapshot state cũ, next = state mới
    expect(addMock).toHaveBeenCalledTimes(1)
    expect(addMock.mock.calls[0][0]).toMatchObject({
      user_id: 'u9',
      entry_id: 'e1',
      kind: 'rating',
      rating: 'good',
      prev: { interval_days: 3, queue: 'review' },
      next: { queue: newState.queue, interval_days: newState.interval_days },
    })
  })

  it('entry に review_state がない → prev null の event', async () => {
    entryStore.set('e2', { user_id: 'u9' })

    await POST(makeReq('e2', 'again'))

    expect(addMock.mock.calls[0][0]).toMatchObject({ entry_id: 'e2', prev: null })
  })

  it('entry が存在しない → update なし、event なし', async () => {
    const res = await POST(makeReq('missing', 'good'))
    expect(res.status).toBe(200)
    expect(updateMock).not.toHaveBeenCalled()
    expect(addMock).not.toHaveBeenCalled()
  })
})
