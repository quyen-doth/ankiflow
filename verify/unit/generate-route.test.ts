import { beforeEach, describe, expect, it, vi } from 'vitest'

const { verifyMock, generateMock } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  generateMock: vi.fn(),
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuthInstance: () => ({ verifySessionCookie: verifyMock }),
  getAdminDb: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => ({
          exists: true,
          data: () => ({ ai_model: 'claude-haiku-4-5', web_search_enabled: false }),
        }),
      }),
    }),
  }),
}))

vi.mock('@/lib/ai-agent', () => ({
  createAIAgentProvider: () => ({ generateCard: generateMock }),
}))

import { POST } from '@/app/api/generate/route'

const ROUTE_CONTEXT = { params: Promise.resolve({}) }

function makeRequest(body: unknown, authenticated = true): Request {
  return new Request('http://localhost:3000/api/generate', {
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
  generateMock.mockReset()
  verifyMock.mockResolvedValue({ uid: 'user-1', email: 'user@example.com' })
})

describe('POST /api/generate — customizable languages', () => {
  it('session がない → 401', async () => {
    const response = await POST(makeRequest({ form_type: 'form_language', word: 'bonjour', language: 'fr' }, false), ROUTE_CONTEXT)
    expect(response.status).toBe(401)
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('language form で language がない、または無効 → 400', async () => {
    const missing = await POST(makeRequest({ form_type: 'form_language', word: 'bonjour' }), ROUTE_CONTEXT)
    expect(missing.status).toBe(400)

    const invalid = await POST(makeRequest({
      form_type: 'form_language',
      word: 'bonjour',
      language: 'not a language',
    }), ROUTE_CONTEXT)
    expect(invalid.status).toBe(400)
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('任意の BCP 47 language を canonicalize して provider に渡す', async () => {
    const content = { word: 'olá', ipa: '/oˈla/', meaning_vi: 'xin chào' }
    generateMock.mockResolvedValueOnce(content)

    const response = await POST(makeRequest({
      form_type: 'form_language',
      word: 'olá',
      language: 'pt_br',
      language_name: 'Português',
    }), ROUTE_CONTEXT)

    expect(response.status).toBe(200)
    expect(generateMock).toHaveBeenCalledWith(expect.objectContaining({
      form_type: 'form_language',
      word: 'olá',
      language: 'pt-BR',
      language_name: 'Português',
    }))
    expect(await response.json()).toEqual({ content })
  })
})
