import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface EntryDoc {
  id: string
  data: Record<string, unknown>
}

const {
  globalSettings,
  userSettings,
  entriesByUser,
  settingsUpdates,
  pushMessageMock,
} = vi.hoisted(() => ({
  globalSettings: {} as Record<string, unknown>,
  userSettings: {} as Record<string, Record<string, unknown>>,
  entriesByUser: {} as Record<string, EntryDoc[]>,
  settingsUpdates: [] as Array<{ uid: string; data: Record<string, unknown> }>,
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
  getAdminDb: () => ({
    collection: (collectionName: string) => {
      if (collectionName === 'settings') {
        return {
          doc: (uid: string) => ({
            get: async () => ({
              data: () => (uid === 'global' ? globalSettings : userSettings[uid]),
            }),
            update: async (data: Record<string, unknown>) => {
              settingsUpdates.push({ uid, data })
            },
          }),
          where: () => ({
            get: async () => ({
              docs: Object.entries(userSettings)
                .filter(([, data]) => data.line_notifications_enabled === true)
                .map(([id, data]) => ({ id, data: () => data })),
            }),
          }),
        }
      }

      return {
        where: (_field: string, _operator: string, uid: string) => ({
          where: () => ({
            get: async () => ({
              docs: (entriesByUser[uid] ?? []).map((entry) => ({
                id: entry.id,
                data: () => entry.data,
              })),
            }),
          }),
        }),
      }
    },
  }),
}))

vi.mock('@/lib/line/client', () => ({
  pushMessage: pushMessageMock,
}))

import { GET } from '@/app/api/cron/srs-push/route'

const ORIGINAL_SECRET = process.env.CRON_SECRET
const ORIGINAL_LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN

function makeRequest(bearer: string | null) {
  const headers: Record<string, string> = {}
  if (bearer !== null) headers.authorization = `Bearer ${bearer}`
  return new Request('http://localhost:3000/api/cron/srs-push', { headers })
}

function dueEntry(id: string, overrides: Record<string, unknown> = {}): EntryDoc {
  return {
    id,
    data: {
      word: id,
      review_state: {
        due_date: '2020-01-01T00:00:00.000Z',
        queue: 'review',
        lapses: 0,
        ease_factor: 2.5,
      },
      ...overrides,
    },
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-16T03:00:00.000Z'))
  process.env.CRON_SECRET = 'cron-secret-xyz'
  process.env.LINE_CHANNEL_ACCESS_TOKEN = 'line-token'

  for (const key of Object.keys(globalSettings)) delete globalSettings[key]
  for (const key of Object.keys(userSettings)) delete userSettings[key]
  for (const key of Object.keys(entriesByUser)) delete entriesByUser[key]
  settingsUpdates.length = 0
  Object.assign(globalSettings, {
    line_notifications_available: true,
    line_schedule_hours: [12],
    line_words_per_notification: 5,
  })
  userSettings.user1 = {
    line_notifications_enabled: true,
    line_user_id: 'line-user-1',
    line_timezone: 'Asia/Tokyo',
  }
  pushMessageMock.mockReset()
  pushMessageMock.mockResolvedValue({ success: true })
})

afterEach(() => {
  vi.useRealTimers()
  process.env.CRON_SECRET = ORIGINAL_SECRET
  process.env.LINE_CHANNEL_ACCESS_TOKEN = ORIGINAL_LINE_TOKEN
})

describe('GET /api/cron/srs-push — auth', () => {
  it('Bearer が不正なら 401 を返して LINE を呼ばない', async () => {
    const response = await GET(makeRequest('wrong-secret'))

    expect(response.status).toBe(401)
    expect(pushMessageMock).not.toHaveBeenCalled()
  })

  it('Authorization header がなければ 401 を返す', async () => {
    const response = await GET(makeRequest(null))

    expect(response.status).toBe(401)
  })
})

describe('GET /api/cron/srs-push — user ごとの配信', () => {
  it('管理者が無効化している場合は配信しない', async () => {
    globalSettings.line_notifications_available = false

    const response = await GET(makeRequest('cron-secret-xyz'))

    expect(await response.json()).toEqual({ pushed: 0, reason: 'disabled' })
    expect(pushMessageMock).not.toHaveBeenCalled()
  })

  it('配信時刻が未設定なら配信しない', async () => {
    globalSettings.line_schedule_hours = []

    const response = await GET(makeRequest('cron-secret-xyz'))

    expect(await response.json()).toEqual({ pushed: 0, reason: 'no schedule' })
  })

  it('現地時刻が一致する user の LINE ID に due entry を送信する', async () => {
    entriesByUser.user1 = [dueEntry('e1'), dueEntry('e2')]

    const response = await GET(makeRequest('cron-secret-xyz'))

    expect(await response.json()).toEqual({ pushed: 1, skipped: 0, failed: 0 })
    expect(pushMessageMock).toHaveBeenCalledTimes(1)
    const [token, lineUserId, messages] = pushMessageMock.mock.calls[0]
    expect(token).toBe('line-token')
    expect(lineUserId).toBe('line-user-1')
    expect(messages[0].type).toBe('flex')
    expect(settingsUpdates).toEqual([
      {
        uid: 'user1',
        data: { line_last_push_key: '2026-07-16T12@Asia/Tokyo' },
      },
    ])
  })

  it('timezone が異なる 2 user のうち配信時刻が一致する user だけに送る', async () => {
    userSettings.user2 = {
      line_notifications_enabled: true,
      line_user_id: 'line-user-2',
      line_timezone: 'America/New_York',
    }
    entriesByUser.user1 = [dueEntry('tokyo-entry')]
    entriesByUser.user2 = [dueEntry('new-york-entry')]

    const response = await GET(makeRequest('cron-secret-xyz'))

    expect(await response.json()).toEqual({ pushed: 1, skipped: 1, failed: 0 })
    expect(pushMessageMock).toHaveBeenCalledTimes(1)
    expect(pushMessageMock.mock.calls[0][1]).toBe('line-user-1')
  })

  it('同じローカル時刻の guard key があれば skip する', async () => {
    userSettings.user1.line_last_push_key = '2026-07-16T12@Asia/Tokyo'
    entriesByUser.user1 = [dueEntry('e1')]

    const response = await GET(makeRequest('cron-secret-xyz'))

    expect(await response.json()).toEqual({ pushed: 0, skipped: 1, failed: 0 })
    expect(pushMessageMock).not.toHaveBeenCalled()
  })

  it('LINE account が未連携なら skip する', async () => {
    delete userSettings.user1.line_user_id
    entriesByUser.user1 = [dueEntry('e1')]

    const response = await GET(makeRequest('cron-secret-xyz'))

    expect(await response.json()).toEqual({ pushed: 0, skipped: 1, failed: 0 })
    expect(pushMessageMock).not.toHaveBeenCalled()
  })

  it('due entry がなければ skip し、送信キーを更新しない', async () => {
    const response = await GET(makeRequest('cron-secret-xyz'))

    expect(await response.json()).toEqual({ pushed: 0, skipped: 1, failed: 0 })
    expect(pushMessageMock).not.toHaveBeenCalled()
    expect(settingsUpdates).toEqual([])
  })

  it('LINE 送信失敗を集計し、送信キーを更新しない', async () => {
    entriesByUser.user1 = [dueEntry('e1')]
    pushMessageMock.mockResolvedValueOnce({ success: false, error: 'boom' })

    const response = await GET(makeRequest('cron-secret-xyz'))

    expect(await response.json()).toEqual({ pushed: 0, skipped: 0, failed: 1 })
    expect(settingsUpdates).toEqual([])
  })

  it('管理者設定の単語数を 1 回の Flex message に適用する', async () => {
    globalSettings.line_words_per_notification = 2
    entriesByUser.user1 = Array.from({ length: 5 }, (_, index) => dueEntry(`e${index}`))

    await GET(makeRequest('cron-secret-xyz'))

    const message = pushMessageMock.mock.calls[0][2][0] as unknown as {
      contents: { type: string; contents?: unknown[] }
    }
    expect(message.contents.type).toBe('carousel')
    expect(message.contents.contents).toHaveLength(2)
  })
})
