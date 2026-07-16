import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { PROTECTED_GLOBAL_CONTENT_TYPE_IDS } from '@/lib/constants'

const { verifyMock, documents, updates, deletes } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  documents: new Map<string, Record<string, unknown>>(),
  updates: [] as Array<{ path: string; data: Record<string, unknown> }>,
  deletes: [] as string[],
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuthInstance: () => ({ verifySessionCookie: verifyMock }),
  getAdminDb: () => ({
    collection: (collectionName: string) => ({
      get: async () => ({
        docs: [...documents.entries()]
          .filter(([path]) => path.startsWith(`${collectionName}/`))
          .map(([path, data]) => ({
            id: path.slice(collectionName.length + 1),
            data: () => data,
          })),
      }),
      doc: (id: string) => {
        const path = `${collectionName}/${id}`
        return {
          update: async (data: Record<string, unknown>) => {
            updates.push({ path, data })
            documents.set(path, { ...(documents.get(path) ?? {}), ...data })
          },
          delete: async () => {
            deletes.push(path)
            documents.delete(path)
          },
        }
      },
    }),
  }),
}))

import { DELETE, GET, PUT } from '@/app/api/admin/content-types/route'

const ROUTE_CONTEXT = { params: Promise.resolve({}) }

function request(
  method: 'GET' | 'PUT' | 'DELETE',
  options: { cookie?: boolean; id?: string; body?: unknown } = {},
): NextRequest {
  const search = options.id === undefined ? '' : `?id=${encodeURIComponent(options.id)}`
  return new NextRequest(`http://localhost:3000/api/admin/content-types${search}`, {
    method,
    headers: {
      ...(options.cookie === false ? {} : { cookie: '__session=ok' }),
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  })
}

beforeEach(() => {
  verifyMock.mockReset().mockResolvedValue({ uid: 'admin-uid', email: 'owner@ankiflow.dev' })
  documents.clear()
  updates.length = 0
  deletes.length = 0
  vi.stubEnv('ADMIN_EMAIL', 'owner@ankiflow.dev')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/admin/content-types', () => {
  it('session がなければ 401', async () => {
    const response = await GET(request('GET', { cookie: false }), ROUTE_CONTEXT)

    expect(response.status).toBe(401)
  })

  it('signed-in user は admin でなくても global defaults を取得できる', async () => {
    verifyMock.mockResolvedValueOnce({ uid: 'user-a', email: 'user@example.com' })
    documents.set('content_types/form_language', { code: 'language', name: 'Language' })

    const response = await GET(request('GET'), ROUTE_CONTEXT)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      contentTypes: [{ id: 'form_language', code: 'language', name: 'Language' }],
    })
  })
})

describe('PUT /api/admin/content-types', () => {
  const validBody = {
    id: 'form_language',
    fields: [{ field_key: 'word', label: 'Word' }],
  }

  it('session がなければ 401、Firestore を更新しない', async () => {
    const response = await PUT(
      request('PUT', { cookie: false, body: validBody }),
      ROUTE_CONTEXT,
    )

    expect(response.status).toBe(401)
    expect(updates).toEqual([])
  })

  it('non-admin session は 403、Firestore を更新しない', async () => {
    verifyMock.mockResolvedValueOnce({ uid: 'user-a', email: 'user@example.com' })

    const response = await PUT(request('PUT', { body: validBody }), ROUTE_CONTEXT)

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Forbidden — admin only' })
    expect(updates).toEqual([])
  })

  it('ADMIN_EMAIL が未設定なら fail-closed で 403', async () => {
    vi.stubEnv('ADMIN_EMAIL', '')

    const response = await PUT(request('PUT', { body: validBody }), ROUTE_CONTEXT)

    expect(response.status).toBe(403)
    expect(updates).toEqual([])
  })

  it('admin session は fields を更新できる', async () => {
    const response = await PUT(request('PUT', { body: validBody }), ROUTE_CONTEXT)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, id: 'form_language' })
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({
      path: 'content_types/form_language',
      data: { fields: validBody.fields, updated_at: expect.any(Date) },
    })
  })
})

describe('DELETE /api/admin/content-types', () => {
  it('id がなければ 400', async () => {
    const response = await DELETE(request('DELETE'), ROUTE_CONTEXT)

    expect(response.status).toBe(400)
    expect(deletes).toEqual([])
  })

  it('non-admin session は custom Content Type も削除できない', async () => {
    verifyMock.mockResolvedValueOnce({ uid: 'user-a', email: 'user@example.com' })

    const response = await DELETE(request('DELETE', { id: 'custom_medical' }), ROUTE_CONTEXT)

    expect(response.status).toBe(403)
    expect(deletes).toEqual([])
  })

  it.each(PROTECTED_GLOBAL_CONTENT_TYPE_IDS)('%s は admin でも削除できない', async (id) => {
    const response = await DELETE(request('DELETE', { id }), ROUTE_CONTEXT)

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Built-in content types cannot be deleted' })
    expect(deletes).toEqual([])
  })

  it('admin は global custom Content Type を削除できる', async () => {
    documents.set('content_types/custom_medical', { code: 'medical', name: 'Medical' })

    const response = await DELETE(request('DELETE', { id: 'custom_medical' }), ROUTE_CONTEXT)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, id: 'custom_medical' })
    expect(deletes).toEqual(['content_types/custom_medical'])
    expect(documents.has('content_types/custom_medical')).toBe(false)
  })
})
