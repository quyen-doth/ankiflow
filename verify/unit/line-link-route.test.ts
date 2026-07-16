import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockDocumentRef {
  collection: string
  id: string
}

const {
  verifyMock,
  globalSettings,
  settingsStore,
  codeStore,
  settingsUpdates,
  generatedCodes,
} = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  globalSettings: {} as Record<string, unknown>,
  settingsStore: new Map<string, Record<string, unknown>>(),
  codeStore: new Map<string, Record<string, unknown>>(),
  settingsUpdates: [] as Array<{ uid: string; data: Record<string, unknown> }>,
  generatedCodes: [] as string[],
}))

vi.mock('@/lib/line/link-code', () => ({
  generateLineLinkCode: () => generatedCodes.shift() ?? 'ANKI-ZZZZ',
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuthInstance: () => ({ verifySessionCookie: verifyMock }),
  getAdminDb: () => ({
    collection: (collectionName: string) => {
      if (collectionName === 'settings') {
        return {
          doc: (id: string) => ({
            collection: collectionName,
            id,
            get: async () => ({
              data: () => (id === 'global' ? globalSettings : settingsStore.get(id)),
            }),
            update: async (data: Record<string, unknown>) => {
              settingsUpdates.push({ uid: id, data })
              settingsStore.set(id, { ...(settingsStore.get(id) ?? {}), ...data })
            },
          }),
        }
      }

      return {
        where: () => ({
          get: async () => ({
            docs: [...codeStore.entries()]
              .filter(([, data]) => data.uid === 'user1')
              .map(([id]) => ({ ref: { collection: collectionName, id } })),
          }),
        }),
        doc: (id: string): MockDocumentRef => ({ collection: collectionName, id }),
      }
    },
    batch: () => {
      const deletes: MockDocumentRef[] = []
      const creates: Array<{ ref: MockDocumentRef; data: Record<string, unknown> }> = []
      return {
        delete: (ref: MockDocumentRef) => deletes.push(ref),
        create: (ref: MockDocumentRef, data: Record<string, unknown>) => creates.push({ ref, data }),
        commit: async () => {
          for (const ref of deletes) codeStore.delete(ref.id)
          for (const { ref, data } of creates) {
            if (codeStore.has(ref.id)) throw new Error('ALREADY_EXISTS')
            codeStore.set(ref.id, data)
          }
        },
      }
    },
  }),
}))

import { DELETE, POST } from '@/app/api/notifications/line-link/route'

const ROUTE_CONTEXT = { params: Promise.resolve({}) }

function makeRequest(cookie = true) {
  return new Request('http://localhost:3000/api/notifications/line-link', {
    method: 'POST',
    headers: cookie ? { cookie: '__session=ok' } : {},
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-16T03:00:00.000Z'))
  verifyMock.mockReset()
  verifyMock.mockResolvedValue({ uid: 'user1', email: 'user@example.com' })
  for (const key of Object.keys(globalSettings)) delete globalSettings[key]
  settingsStore.clear()
  codeStore.clear()
  settingsUpdates.length = 0
  generatedCodes.length = 0
  generatedCodes.push('ANKI-ABCD', 'ANKI-EFGH')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('POST /api/notifications/line-link', () => {
  it('session がなければ 401', async () => {
    const response = await POST(makeRequest(false), ROUTE_CONTEXT)

    expect(response.status).toBe(401)
    expect(codeStore.size).toBe(0)
  })

  it('管理者が LINE 通知を無効化していれば 403', async () => {
    globalSettings.line_notifications_available = false

    const response = await POST(makeRequest(), ROUTE_CONTEXT)

    expect(response.status).toBe(403)
    expect(codeStore.size).toBe(0)
  })

  it('正規形式の 10 分間有効な link code を作成する', async () => {
    const response = await POST(makeRequest(), ROUTE_CONTEXT)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.code).toMatch(/^ANKI-[A-HJ-NP-Z2-9]{4}$/)
    expect(body.expires_at).toBe('2026-07-16T03:10:00.000Z')
    expect(codeStore.get(body.code)).toEqual({
      uid: 'user1',
      expires_at: '2026-07-16T03:10:00.000Z',
    })
  })

  it('2 回目の生成時に同じ user の古い code を削除する', async () => {
    const first = await (await POST(makeRequest(), ROUTE_CONTEXT)).json()
    const second = await (await POST(makeRequest(), ROUTE_CONTEXT)).json()

    expect(first.code).toBe('ANKI-ABCD')
    expect(second.code).toBe('ANKI-EFGH')
    expect(codeStore.has(first.code)).toBe(false)
    expect([...codeStore.keys()]).toEqual([second.code])
  })
})

describe('DELETE /api/notifications/line-link', () => {
  it('LINE ID を削除し、reminder を無効化する', async () => {
    settingsStore.set('user1', {
      line_user_id: 'line-user-1',
      line_notifications_enabled: true,
    })

    const response = await DELETE(makeRequest(), ROUTE_CONTEXT)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(settingsUpdates).toHaveLength(1)
    expect(settingsUpdates[0].uid).toBe('user1')
    expect(settingsUpdates[0].data).toMatchObject({
      line_notifications_enabled: false,
      updated_at: expect.any(Date),
    })
    expect(settingsUpdates[0].data).toHaveProperty('line_user_id')
  })
})
