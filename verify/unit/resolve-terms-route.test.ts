import { beforeEach, describe, expect, it, vi } from 'vitest'

const { verifyMock, resolveMock } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  resolveMock: vi.fn(),
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuthInstance: () => ({ verifySessionCookie: verifyMock }),
  getAdminDb: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: true, data: () => ({ ai_model: 'claude-haiku-4-5' }) }),
      }),
    }),
  }),
}))

vi.mock('@/lib/ai-agent', () => ({
  createAIAgentProvider: () => ({ resolveTerms: resolveMock }),
}))

import { POST } from '@/app/api/languages/resolve-terms/route'

const ROUTE_CONTEXT = { params: Promise.resolve({}) }

function makeRequest(body: unknown, authenticated = true): Request {
  return new Request('http://localhost:3000/api/languages/resolve-terms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authenticated ? { cookie: '__session=ok' } : {}),
    },
    body: JSON.stringify(body),
  })
}

const JAPANESE = { code: 'ja', display_name: 'Japanese' }

beforeEach(() => {
  verifyMock.mockReset()
  resolveMock.mockReset()
  verifyMock.mockResolvedValue({ uid: 'user-1', email: 'user@example.com' })
})

describe('POST /api/languages/resolve-terms', () => {
  it('requires an authenticated session', async () => {
    const response = await POST(
      makeRequest({ items: ['water'], target_language: JAPANESE }, false),
      ROUTE_CONTEXT,
    )
    expect(response.status).toBe(401)
    expect(resolveMock).not.toHaveBeenCalled()
  })

  it('validates request shape and the target BCP 47 code', async () => {
    const empty = await POST(makeRequest({ items: [], target_language: JAPANESE }), ROUTE_CONTEXT)
    expect(empty.status).toBe(400)

    const missingTarget = await POST(makeRequest({ items: ['water'] }), ROUTE_CONTEXT)
    expect(missingTarget.status).toBe(400)

    const invalidCode = await POST(makeRequest({
      items: ['water'],
      target_language: { code: 'not a language', display_name: 'Invalid' },
    }), ROUTE_CONTEXT)
    expect(invalidCode.status).toBe(400)
    expect(resolveMock).not.toHaveBeenCalled()
  })

  it('canonicalizes the target language and returns structured resolutions', async () => {
    resolveMock.mockResolvedValueOnce([
      { index: 0, resolved_term: '水', source_language: 'en', was_translated: true },
    ])

    const response = await POST(makeRequest({
      items: ['water'],
      target_language: { code: 'ja_jp', display_name: 'Japanese' },
    }), ROUTE_CONTEXT)

    expect(response.status).toBe(200)
    expect(resolveMock).toHaveBeenCalledWith({
      items: ['water'],
      targetLanguage: { code: 'ja-JP', display_name: 'Japanese' },
    })
    expect(await response.json()).toEqual({
      resolutions: [{ index: 0, resolved_term: '水', source_language: 'en', was_translated: true }],
    })
  })

  it('returns a safe 500 response when the provider fails', async () => {
    resolveMock.mockRejectedValueOnce(new Error('Resolver unavailable'))
    const response = await POST(
      makeRequest({ items: ['water'], target_language: JAPANESE }),
      ROUTE_CONTEXT,
    )
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Resolver unavailable' })
  })
})
