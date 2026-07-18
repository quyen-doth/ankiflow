import { beforeEach, describe, expect, it, vi } from 'vitest'

const { verifyMock, generateMock, contentTypeDocs } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  generateMock: vi.fn(),
  contentTypeDocs: new Map<string, Record<string, unknown>>(),
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuthInstance: () => ({ verifySessionCookie: verifyMock }),
  getAdminDb: () => ({
    collection: (collectionName: string) => ({
      doc: (id: string) => ({
        get: async () => {
          if (collectionName === 'settings') {
            return {
              exists: true,
              data: () => ({ ai_model: 'claude-haiku-4-5', web_search_enabled: false }),
            }
          }
          const data = contentTypeDocs.get(id)
          return {
            exists: data !== undefined,
            data: () => data,
          }
        },
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
  contentTypeDocs.clear()
  verifyMock.mockResolvedValue({ uid: 'user-1', email: 'user@example.com' })
})

function languageContentType(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    user_id: 'user-1',
    code: 'language',
    name: 'Workspace Language',
    description: 'Vocabulary learning',
    fields: [
      {
        field_key: 'language',
        label: 'Study language',
        type: 'dropdown',
        is_required: true,
        is_session_persistent: true,
        sort_order: 0,
      },
      {
        field_key: 'word',
        label: 'Vocabulary item',
        type: 'text',
        is_required: true,
        is_session_persistent: false,
        sort_order: 1,
      },
    ],
    ai_output_profiles: [{
      profile: 'default',
      fields: [
        { key: 'word', type: 'string', instruction: 'Vocabulary word' },
        { key: 'meaning_vi', type: 'string', instruction: 'Meaning in {output_language}' },
      ],
    }],
    ...overrides,
  }
}

describe('POST /api/generate — customizable languages', () => {
  it('session がない → 401', async () => {
    const response = await POST(makeRequest({ form_type: 'form_language', word: 'bonjour', language: 'fr' }, false), ROUTE_CONTEXT)
    expect(response.status).toBe(401)
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('content_type_id から owner/code を検証し、authoritative definition を渡す', async () => {
    contentTypeDocs.set('form_language__user-1', languageContentType())
    generateMock.mockResolvedValue({ word: 'book', meaning_vi: 'sách' })

    const response = await POST(makeRequest({
      form_type: 'form_language',
      content_type_id: 'form_language__user-1',
      contentTypeName: 'Forged client name',
      word: 'book',
      language: 'en',
    }), ROUTE_CONTEXT)

    expect(response.status).toBe(200)
    expect(generateMock).toHaveBeenCalledWith(expect.objectContaining({
      contentTypeName: 'Workspace Language',
      content_type: expect.objectContaining({
        name: 'Workspace Language',
        primary_field_key: 'word',
        field_labels: {
          language: 'Study language',
          word: 'Vocabulary item',
        },
      }),
    }))
  })

  it('他 user の content type は存在を隠して 404 にする', async () => {
    contentTypeDocs.set('form_language__other', languageContentType({ user_id: 'other-user' }))

    const response = await POST(makeRequest({
      form_type: 'form_language',
      content_type_id: 'form_language__other',
      word: 'book',
      language: 'en',
    }), ROUTE_CONTEXT)

    expect(response.status).toBe(404)
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('document routing code と form_type が一致しない場合は 400', async () => {
    contentTypeDocs.set('wrong-route', languageContentType({ code: 'it' }))

    const response = await POST(makeRequest({
      form_type: 'form_language',
      content_type_id: 'wrong-route',
      word: 'book',
      language: 'en',
    }), ROUTE_CONTEXT)

    expect(response.status).toBe(400)
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('stored output profile が不正な場合は provider を呼ばず 400', async () => {
    contentTypeDocs.set('invalid-profile', languageContentType({
      ai_output_profiles: [{
        profile: 'default',
        fields: [{ key: 'status', type: 'string', instruction: 'Override status' }],
      }],
    }))

    const response = await POST(makeRequest({
      form_type: 'form_language',
      content_type_id: 'invalid-profile',
      word: 'book',
      language: 'en',
    }), ROUTE_CONTEXT)

    expect(response.status).toBe(400)
    expect(generateMock).not.toHaveBeenCalled()
  })

  it('legacy document に profiles がなくても authoritative name + fallback を維持する', async () => {
    contentTypeDocs.set('legacy-language', languageContentType({ ai_output_profiles: undefined }))
    generateMock.mockResolvedValue({ word: 'book' })

    const response = await POST(makeRequest({
      form_type: 'form_language',
      content_type_id: 'legacy-language',
      word: 'book',
      language: 'en',
    }), ROUTE_CONTEXT)

    expect(response.status).toBe(200)
    expect(generateMock).toHaveBeenCalledWith(expect.objectContaining({
      contentTypeName: 'Workspace Language',
      content_type: undefined,
    }))
  })

  it('request size bounds を超える dynamicFields は 400', async () => {
    const dynamicFields = Object.fromEntries(
      Array.from({ length: 41 }, (_, index) => [`field_${index}`, 'value']),
    )
    const response = await POST(makeRequest({
      form_type: 'custom_prompt',
      word: 'question',
      dynamicFields,
    }), ROUTE_CONTEXT)

    expect(response.status).toBe(400)
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

  it('output_language がない、または無効な場合は Vietnamese に fallback する', async () => {
    generateMock.mockResolvedValue({ word: 'book' })

    const missing = await POST(makeRequest({
      form_type: 'form_language',
      word: 'book',
      language: 'en',
    }), ROUTE_CONTEXT)
    const invalid = await POST(makeRequest({
      form_type: 'form_language',
      word: 'book',
      language: 'en',
      output_language: 'not a language',
      output_language_name: 'English',
    }), ROUTE_CONTEXT)

    expect(missing.status).toBe(200)
    expect(invalid.status).toBe(200)
    expect(generateMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      output_language: 'vi',
      output_language_name: 'Vietnamese',
    }))
    expect(generateMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      output_language: 'vi',
      output_language_name: 'Vietnamese',
    }))
  })
})
