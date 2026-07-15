import { beforeEach, describe, expect, it, vi } from 'vitest'

const { verifyMock, detectMock } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  detectMock: vi.fn(),
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
  createAIAgentProvider: () => ({ detectLanguages: detectMock }),
}))

import { POST } from '@/app/api/languages/detect/route'

const ROUTE_CONTEXT = { params: Promise.resolve({}) }

function makeRequest(body: unknown, authenticated = true): Request {
  return new Request('http://localhost:3000/api/languages/detect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authenticated ? { cookie: '__session=ok' } : {}),
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  verifyMock.mockReset()
  detectMock.mockReset()
  verifyMock.mockResolvedValue({ uid: 'user-1', email: 'user@example.com' })
})

describe('POST /api/languages/detect', () => {
  it('requires an authenticated session', async () => {
    const response = await POST(makeRequest({ items: ['hello'], candidate_languages: [] }, false), ROUTE_CONTEXT)
    expect(response.status).toBe(401)
    expect(detectMock).not.toHaveBeenCalled()
  })

  it('validates request shape and BCP 47 candidate codes', async () => {
    const empty = await POST(makeRequest({ items: [], candidate_languages: [] }), ROUTE_CONTEXT)
    expect(empty.status).toBe(400)

    const invalidCode = await POST(makeRequest({
      items: ['hello'],
      candidate_languages: [{ code: 'not a language', display_name: 'Invalid' }],
    }), ROUTE_CONTEXT)
    expect(invalidCode.status).toBe(400)
    expect(detectMock).not.toHaveBeenCalled()
  })

  it('canonicalizes candidates and returns structured detections', async () => {
    detectMock.mockResolvedValueOnce([
      { index: 0, code: 'pt-BR', display_name: 'Português', confidence: 0.93 },
    ])

    const response = await POST(makeRequest({
      items: ['olá'],
      candidate_languages: [{ code: 'pt_br', display_name: 'Português' }],
    }), ROUTE_CONTEXT)

    expect(response.status).toBe(200)
    expect(detectMock).toHaveBeenCalledWith({
      items: ['olá'],
      candidateLanguages: [{ code: 'pt-BR', display_name: 'Português' }],
    })
    expect(await response.json()).toEqual({
      detections: [{ index: 0, code: 'pt-BR', display_name: 'Português', confidence: 0.93 }],
    })
  })

  it('returns a safe 500 response when the provider fails', async () => {
    detectMock.mockRejectedValueOnce(new Error('Detector unavailable'))
    const response = await POST(makeRequest({ items: ['hello'], candidate_languages: [] }), ROUTE_CONTEXT)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Detector unavailable' })
  })
})
