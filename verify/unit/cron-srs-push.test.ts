import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * GET /api/cron/srs-push — auth Bearer CRON_SECRET, chọn đúng entries due của 1 target
 * uid cố định, push qua LINE (mock), 0 due → không gọi LINE.
 */

interface EntryDoc {
  id: string
  data: Record<string, unknown>
}

const { entryDocs, pushMessageMock } = vi.hoisted(() => ({
  entryDocs: [] as EntryDoc[],
  pushMessageMock: vi
    .fn<(token: string, userId: string, messages: Array<{ type: string }>) => Promise<{ success: boolean; error?: string }>>()
    .mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminDb: () => ({
    collection: () => ({
      where: () => ({
        where: () => ({
          get: async () => ({ docs: entryDocs.map((e) => ({ id: e.id, data: () => e.data })), empty: entryDocs.length === 0 }),
        }),
      }),
    }),
  }),
}))

vi.mock('@/lib/line/client', () => ({
  pushMessage: pushMessageMock,
}))

import { GET } from '@/app/api/cron/srs-push/route'

const ORIGINAL_SECRET = process.env.CRON_SECRET
const ORIGINAL_TARGET = process.env.SRS_PUSH_TARGET_UID
const ORIGINAL_INTEGRATION_TARGET = process.env.INTEGRATION_TARGET_UID
const ORIGINAL_LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN
const ORIGINAL_LINE_USER = process.env.LINE_USER_ID

function makeReq(bearer: string | null) {
  const headers: Record<string, string> = {}
  if (bearer !== null) headers.authorization = `Bearer ${bearer}`
  return new Request('http://localhost:3000/api/cron/srs-push', { headers })
}

function dueEntry(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: {
      word: id,
      review_state: {
        due_date: '2020-01-01T00:00:00.000Z', // luôn due (trong quá khứ xa)
        queue: 'review',
        lapses: 0,
        ease_factor: 2.5,
      },
      ...overrides,
    },
  }
}

beforeEach(() => {
  process.env.CRON_SECRET = 'cron-secret-xyz'
  process.env.SRS_PUSH_TARGET_UID = 'push-target-uid'
  process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token'
  process.env.LINE_USER_ID = 'line-user'
  entryDocs.length = 0
  pushMessageMock.mockClear()
  pushMessageMock.mockResolvedValue({ success: true })
})

afterEach(() => {
  process.env.CRON_SECRET = ORIGINAL_SECRET
  process.env.SRS_PUSH_TARGET_UID = ORIGINAL_TARGET
  process.env.INTEGRATION_TARGET_UID = ORIGINAL_INTEGRATION_TARGET
  process.env.LINE_CHANNEL_ACCESS_TOKEN = ORIGINAL_LINE_TOKEN
  process.env.LINE_USER_ID = ORIGINAL_LINE_USER
})

describe('GET /api/cron/srs-push — auth', () => {
  it('Bearer đúng → xử lý bình thường', async () => {
    entryDocs.push(dueEntry('e1'))
    const res = await GET(makeReq('cron-secret-xyz'))
    expect(res.status).toBe(200)
  })

  it('Bearer sai → 401, không gọi LINE', async () => {
    entryDocs.push(dueEntry('e1'))
    const res = await GET(makeReq('wrong-secret'))
    expect(res.status).toBe(401)
    expect(pushMessageMock).not.toHaveBeenCalled()
  })

  it('thiếu header Authorization → 401', async () => {
    const res = await GET(makeReq(null))
    expect(res.status).toBe(401)
  })
})

describe('GET /api/cron/srs-push — chọn entries + push', () => {
  it('0 entries due → { pushed: 0 }, không gọi LINE', async () => {
    const res = await GET(makeReq('cron-secret-xyz'))
    const body = await res.json()
    expect(body).toEqual({ pushed: 0 })
    expect(pushMessageMock).not.toHaveBeenCalled()
  })

  it('entry chưa due (due_date tương lai) → không được chọn, pushed: 0', async () => {
    entryDocs.push(dueEntry('e1', { review_state: { due_date: '2099-01-01T00:00:00.000Z', queue: 'review', lapses: 0, ease_factor: 2.5 } }))
    const res = await GET(makeReq('cron-secret-xyz'))
    const body = await res.json()
    expect(body).toEqual({ pushed: 0 })
    expect(pushMessageMock).not.toHaveBeenCalled()
  })

  it('có entries due → gọi pushMessage đúng 1 lần với Flex message hợp lệ', async () => {
    entryDocs.push(dueEntry('e1'), dueEntry('e2'))
    const res = await GET(makeReq('cron-secret-xyz'))
    const body = await res.json()

    expect(body.pushed).toBe(2)
    expect(pushMessageMock).toHaveBeenCalledTimes(1)
    const [token, userId, messages] = pushMessageMock.mock.calls[0]
    expect(token).toBe('line-token')
    expect(userId).toBe('line-user')
    expect(messages[0].type).toBe('flex')
  })

  it('giới hạn tối đa 5 entries mỗi lần push dù có nhiều hơn due', async () => {
    for (let i = 0; i < 8; i++) entryDocs.push(dueEntry(`e${i}`))
    const res = await GET(makeReq('cron-secret-xyz'))
    const body = await res.json()
    expect(body.pushed).toBe(5)
  })

  it('LINE push thất bại → 502', async () => {
    entryDocs.push(dueEntry('e1'))
    pushMessageMock.mockResolvedValueOnce({ success: false, error: 'boom' })
    const res = await GET(makeReq('cron-secret-xyz'))
    expect(res.status).toBe(502)
  })

  it('fallback sang INTEGRATION_TARGET_UID khi thiếu SRS_PUSH_TARGET_UID', async () => {
    delete process.env.SRS_PUSH_TARGET_UID
    process.env.INTEGRATION_TARGET_UID = 'fallback-uid'
    entryDocs.push(dueEntry('e1'))
    const res = await GET(makeReq('cron-secret-xyz'))
    expect(res.status).toBe(200)
  })

  it('thiếu cả 2 target uid → 500', async () => {
    delete process.env.SRS_PUSH_TARGET_UID
    delete process.env.INTEGRATION_TARGET_UID
    const res = await GET(makeReq('cron-secret-xyz'))
    expect(res.status).toBe(500)
  })
})
