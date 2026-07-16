import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface EntryDoc {
  id: string
  data: Record<string, unknown>
}

const { verifyMock, settingsStore, entryDocs, queriedUserIds, transactionRuns, pushMessageMock } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  settingsStore: new Map<string, Record<string, unknown>>(),
  entryDocs: [] as EntryDoc[],
  queriedUserIds: [] as string[],
  transactionRuns: [] as string[],
  pushMessageMock: vi
    .fn<
      (
        token: string,
        userId: string,
        messages: Array<{ type: string }>,
      ) => Promise<{ success: boolean; error?: string }>
    >()
    .mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuthInstance: () => ({ verifySessionCookie: verifyMock }),
  getAdminDb: () => ({
    collection: (collectionName: string) => {
      if (collectionName === 'settings') {
        return {
          doc: (id: string) => ({
            id,
            get: async () => ({ data: () => settingsStore.get(id) }),
          }),
        }
      }

      return {
        where: (_field: string, _operator: string, uid: string) => {
          queriedUserIds.push(uid)
          return {
            where: () => ({
              get: async () => ({
                empty: entryDocs.length === 0,
                docs: entryDocs.map((entry) => ({ id: entry.id, data: () => entry.data })),
              }),
            }),
          }
        },
      }
    },
    runTransaction: async (
      handler: (transaction: {
        get: (ref: { id: string }) => Promise<{ data: () => Record<string, unknown> | undefined }>
        update: (ref: { id: string }, data: Record<string, unknown>) => void
      }) => Promise<unknown>,
    ) => {
      transactionRuns.push('run')
      return handler({
        get: async (ref) => ({ data: () => settingsStore.get(ref.id) }),
        update: (ref, data) => {
          settingsStore.set(ref.id, { ...(settingsStore.get(ref.id) ?? {}), ...data })
        },
      })
    },
  }),
}))

vi.mock('@/lib/line/client', () => ({
  pushMessage: pushMessageMock,
}))

import { POST } from '@/app/api/notifications/send/route'

const ORIGINAL_LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN

function makeRequest(body: unknown = {}) {
  return new Request('http://localhost:3000/api/notifications/send', {
    method: 'POST',
    headers: { cookie: '__session=ok', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function dueEntry(id: string): EntryDoc {
  return {
    id,
    data: {
      word: id,
      meaning_vi: `Meaning of ${id}`,
      review_state: {
        due_date: '2020-01-01T00:00:00.000Z',
        queue: 'review',
        lapses: 0,
        ease_factor: 2.5,
      },
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-16T03:00:00.000Z'))
  verifyMock.mockReset()
  settingsStore.clear()
  entryDocs.length = 0
  queriedUserIds.length = 0
  transactionRuns.length = 0
  pushMessageMock.mockReset()
  pushMessageMock.mockResolvedValue({ success: true })
  process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token'
})

afterEach(() => {
  vi.useRealTimers()
  process.env.LINE_CHANNEL_ACCESS_TOKEN = ORIGINAL_LINE_TOKEN
})

describe('POST /api/notifications/send', () => {
  it('session がなければ 401', async () => {
    const response = await POST(new Request('http://localhost:3000/api/notifications/send', {
      method: 'POST',
    }))

    expect(response.status).toBe(401)
    expect(pushMessageMock).not.toHaveBeenCalled()
  })

  it('管理者が LINE 通知を無効化していれば 403', async () => {
    verifyMock.mockResolvedValueOnce({ uid: 'user1', email: 'user@example.com' })
    settingsStore.set('global', { line_notifications_available: false })
    settingsStore.set('user1', { line_user_id: 'line-user-1' })

    const response = await POST(makeRequest())

    expect(response.status).toBe(403)
    expect(pushMessageMock).not.toHaveBeenCalled()
  })

  it('LINE account が未連携なら 400', async () => {
    verifyMock.mockResolvedValueOnce({ uid: 'user1', email: 'user@example.com' })
    settingsStore.set('global', { line_notifications_available: true })
    settingsStore.set('user1', {})

    const response = await POST(makeRequest())

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Link your LINE account in Settings first' })
  })

  it('caller の uid で entry を絞り、caller の LINE ID に送信する', async () => {
    verifyMock.mockResolvedValueOnce({ uid: 'user1', email: 'user@example.com' })
    settingsStore.set('global', {
      line_notifications_available: true,
      line_words_per_notification: 2,
    })
    settingsStore.set('user1', { line_user_id: 'line-user-1' })
    entryDocs.push(dueEntry('e1'), dueEntry('e2'), dueEntry('e3'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.sent).toBe(2)
    expect(queriedUserIds).toEqual(['user1'])
    expect(pushMessageMock).toHaveBeenCalledTimes(1)
    expect(pushMessageMock.mock.calls[0][0]).toBe('line-token')
    expect(pushMessageMock.mock.calls[0][1]).toBe('line-user-1')
    expect(pushMessageMock.mock.calls[0][2][0].type).toBe('flex')
    expect(transactionRuns).toEqual(['run'])
    expect(settingsStore.get('user1')?.line_last_test_at).toEqual(
      new Date('2026-07-16T03:00:00.000Z'),
    )
  })

  it('60 秒以内の再送を 429 で拒否し、LINE を呼ばない', async () => {
    verifyMock.mockResolvedValueOnce({ uid: 'user1', email: 'user@example.com' })
    settingsStore.set('global', { line_notifications_available: true })
    settingsStore.set('user1', {
      line_user_id: 'line-user-1',
      line_last_test_at: new Date('2026-07-16T02:59:30.000Z'),
    })
    entryDocs.push(dueEntry('e1'))

    const response = await POST(makeRequest())
    const body = await response.json()

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('30')
    expect(body.retry_after_seconds).toBe(30)
    expect(pushMessageMock).not.toHaveBeenCalled()
  })
})
