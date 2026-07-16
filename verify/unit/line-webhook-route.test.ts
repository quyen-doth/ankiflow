import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReviewState } from '@/types'

interface MockDocumentRef {
  collection: string
  id: string
}

interface WebhookEvent {
  type: string
  replyToken: string
  source?: { userId?: string }
  message?: { type: string; text: string }
  postback?: { data: string }
}

const {
  entryStore,
  settingsStore,
  codeStore,
  entryUpdates,
  reviewEvents,
  replyMessageMock,
} = vi.hoisted(() => ({
  entryStore: new Map<string, Record<string, unknown>>(),
  settingsStore: new Map<string, Record<string, unknown>>(),
  codeStore: new Map<string, Record<string, unknown>>(),
  entryUpdates: [] as Array<{ id: string; data: Record<string, unknown> }>,
  reviewEvents: [] as Record<string, unknown>[],
  replyMessageMock: vi
    .fn<
      (
        token: string,
        replyToken: string,
        messages: Array<{ type: string; text?: string }>,
      ) => Promise<{ success: boolean; error?: string }>
    >()
    .mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminDb: () => ({
    collection: (collectionName: string) => {
      if (collectionName === 'review_events') {
        return {
          add: async (data: Record<string, unknown>) => {
            reviewEvents.push(data)
            return { id: `event-${reviewEvents.length}` }
          },
        }
      }

      if (collectionName === 'entries') {
        return {
          doc: (id: string) => ({
            collection: collectionName,
            id,
            get: async () => ({
              exists: entryStore.has(id),
              data: () => entryStore.get(id),
            }),
            update: async (data: Record<string, unknown>) => {
              entryUpdates.push({ id, data })
              entryStore.set(id, { ...(entryStore.get(id) ?? {}), ...data })
            },
          }),
        }
      }

      if (collectionName === 'settings') {
        return {
          doc: (id: string): MockDocumentRef & { get: () => Promise<unknown> } => ({
            collection: collectionName,
            id,
            get: async () => ({
              exists: settingsStore.has(id),
              data: () => settingsStore.get(id),
            }),
          }),
        }
      }

      return {
        doc: (id: string) => ({
          collection: collectionName,
          id,
          get: async () => ({ exists: codeStore.has(id), data: () => codeStore.get(id) }),
          delete: async () => codeStore.delete(id),
        }),
      }
    },
    batch: () => {
      const sets: Array<{ ref: MockDocumentRef; data: Record<string, unknown> }> = []
      const deletes: MockDocumentRef[] = []
      return {
        set: (ref: MockDocumentRef, data: Record<string, unknown>) => sets.push({ ref, data }),
        delete: (ref: MockDocumentRef) => deletes.push(ref),
        commit: async () => {
          for (const { ref, data } of sets) {
            if (ref.collection === 'settings') {
              settingsStore.set(ref.id, { ...(settingsStore.get(ref.id) ?? {}), ...data })
            }
          }
          for (const ref of deletes) {
            if (ref.collection === 'line_link_codes') codeStore.delete(ref.id)
          }
        },
      }
    },
  }),
}))

vi.mock('@/lib/line/client', () => ({
  verifySignatureAsync: async () => true,
  replyMessage: replyMessageMock,
}))

import { POST } from '@/app/api/notifications/line-webhook/route'

const ORIGINAL_SECRET = process.env.LINE_CHANNEL_SECRET
const ORIGINAL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN

function makeRequest(events: WebhookEvent[]) {
  return new Request('http://localhost:3000/api/notifications/line-webhook', {
    method: 'POST',
    headers: { 'x-line-signature': 'sig', 'Content-Type': 'application/json' },
    body: JSON.stringify({ events }),
  })
}

function postbackEvent(entryId: string, rating: string, sourceUserId: string | null = 'line-u9'): WebhookEvent {
  return {
    type: 'postback',
    replyToken: 'reply-postback',
    ...(sourceUserId === null ? {} : { source: { userId: sourceUserId } }),
    postback: { data: `ankiflow:action=srs_rate&entry_id=${entryId}&rating=${rating}` },
  }
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
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-16T03:00:00.000Z'))
  entryStore.clear()
  settingsStore.clear()
  codeStore.clear()
  entryUpdates.length = 0
  reviewEvents.length = 0
  replyMessageMock.mockReset()
  replyMessageMock.mockResolvedValue({ success: true })
  process.env.LINE_CHANNEL_SECRET = 'test-secret'
  process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-access-token'
})

afterEach(() => {
  vi.useRealTimers()
  process.env.LINE_CHANNEL_SECRET = ORIGINAL_SECRET
  process.env.LINE_CHANNEL_ACCESS_TOKEN = ORIGINAL_ACCESS_TOKEN
})

describe('POST /api/notifications/line-webhook — account linking', () => {
  it('有効な code で settings に LINE ID を保存し、code を削除して linked と返信する', async () => {
    codeStore.set('ANKI-ABCD', {
      uid: 'user1',
      expires_at: '2026-07-16T03:10:00.000Z',
    })

    const response = await POST(makeRequest([{
      type: 'message',
      replyToken: 'reply-link',
      source: { userId: 'line-user-1' },
      message: { type: 'text', text: ' anki-abcd ' },
    }]))

    expect(response.status).toBe(200)
    expect(settingsStore.get('user1')).toMatchObject({ line_user_id: 'line-user-1' })
    expect(codeStore.has('ANKI-ABCD')).toBe(false)
    expect(replyMessageMock).toHaveBeenCalledTimes(1)
    expect(replyMessageMock.mock.calls[0][0]).toBe('line-access-token')
    expect(replyMessageMock.mock.calls[0][2][0].text).toContain('now linked')
  })

  it('期限切れ code を削除して expired と返信する', async () => {
    codeStore.set('ANKI-ABCD', {
      uid: 'user1',
      expires_at: '2026-07-16T02:59:59.000Z',
    })

    await POST(makeRequest([{
      type: 'message',
      replyToken: 'reply-expired',
      source: { userId: 'line-user-1' },
      message: { type: 'text', text: 'ANKI-ABCD' },
    }]))

    expect(codeStore.has('ANKI-ABCD')).toBe(false)
    expect(settingsStore.has('user1')).toBe(false)
    expect(replyMessageMock.mock.calls[0][2][0].text).toContain('expired')
  })

  it('通常テキストには返信しない', async () => {
    await POST(makeRequest([{
      type: 'message',
      replyToken: 'reply-normal',
      source: { userId: 'line-user-1' },
      message: { type: 'text', text: 'Hello bot' },
    }]))

    expect(replyMessageMock).not.toHaveBeenCalled()
    expect(settingsStore.size).toBe(0)
  })

  it('follow event に link 手順を返信する', async () => {
    await POST(makeRequest([{
      type: 'follow',
      replyToken: 'reply-follow',
      source: { userId: 'line-user-1' },
    }]))

    expect(replyMessageMock).toHaveBeenCalledTimes(1)
    expect(replyMessageMock.mock.calls[0][2][0].text).toContain('Generate link code')
  })
})

describe('POST /api/notifications/line-webhook — rating ownership', () => {
  it('LINE ID が owner 設定と一致すれば review_state と revlog を更新する', async () => {
    entryStore.set('e1', { user_id: 'u9', review_state: ankiState() })
    settingsStore.set('u9', { line_user_id: 'line-u9' })

    const response = await POST(makeRequest([postbackEvent('e1', 'good')]))
    const body = await response.json()

    expect(body.processed).toBe(1)
    expect(body.results[0].success).toBe(true)
    expect(entryUpdates).toHaveLength(1)
    const newState = entryUpdates[0].data.review_state as ReviewState
    expect(newState.source).toBe('builtin')
    expect(newState.total_reviews).toBe(8)
    expect(reviewEvents[0]).toMatchObject({
      user_id: 'u9',
      entry_id: 'e1',
      kind: 'rating',
      rating: 'good',
      prev: { interval_days: 3, queue: 'review' },
      next: { queue: newState.queue, interval_days: newState.interval_days },
    })
  })

  it('review_state がなければ prev null の revlog を追加する', async () => {
    entryStore.set('e2', { user_id: 'u9' })
    settingsStore.set('u9', { line_user_id: 'line-u9' })

    await POST(makeRequest([postbackEvent('e2', 'again')]))

    expect(reviewEvents[0]).toMatchObject({ entry_id: 'e2', prev: null })
  })

  it.each([
    ['別の LINE ID', 'other-line-user'],
    ['source user ID なし', null],
  ])('%s なら rating を拒否する', async (_label, sourceUserId) => {
    entryStore.set('e1', { user_id: 'u9', review_state: ankiState() })
    settingsStore.set('u9', { line_user_id: 'line-u9' })

    const response = await POST(makeRequest([postbackEvent('e1', 'good', sourceUserId)]))
    const body = await response.json()

    expect(body.processed).toBe(1)
    expect(body.results[0].success).toBe(false)
    expect(entryUpdates).toHaveLength(0)
    expect(reviewEvents).toHaveLength(0)
  })

  it('entry が存在しなければ rating を拒否する', async () => {
    const response = await POST(makeRequest([postbackEvent('missing', 'good')]))
    const body = await response.json()

    expect(body.results[0].success).toBe(false)
    expect(entryUpdates).toHaveLength(0)
    expect(reviewEvents).toHaveLength(0)
  })
})
