import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  verifyMock,
  readAISettingsMock,
  createProviderMock,
  suggestInstructionMock,
} = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  readAISettingsMock: vi.fn(),
  createProviderMock: vi.fn(),
  suggestInstructionMock: vi.fn(),
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuthInstance: () => ({ verifySessionCookie: verifyMock }),
}))

vi.mock('@/lib/ai-settings', () => ({
  readAISettings: readAISettingsMock,
}))

vi.mock('@/lib/ai-agent', () => ({
  createAIAgentProvider: createProviderMock,
}))

import { POST } from '@/app/api/content-types/suggest-instruction/route'

const ROUTE_CONTEXT = { params: Promise.resolve({}) }

function makeRequest(body: unknown, authenticated = true): Request {
  return new Request('http://localhost:3000/api/content-types/suggest-instruction', {
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
  readAISettingsMock.mockReset()
  createProviderMock.mockReset()
  suggestInstructionMock.mockReset()
  verifyMock.mockResolvedValue({ uid: 'user-1', email: 'user@example.com' })
  readAISettingsMock.mockResolvedValue({
    model: 'claude-sonnet-4-6',
    webSearchEnabled: true,
  })
  createProviderMock.mockReturnValue({ suggestInstruction: suggestInstructionMock })
})

describe('POST /api/content-types/suggest-instruction', () => {
  it('requires an authenticated session', async () => {
    const response = await POST(makeRequest({
      field_key: 'meaning',
      type: 'string',
      description: 'A concise definition',
    }, false), ROUTE_CONTEXT)

    expect(response.status).toBe(401)
    expect(createProviderMock).not.toHaveBeenCalled()
  })

  it.each([
    [{ field_key: 'Invalid Key', type: 'string', description: 'A definition' }],
    [{ field_key: 'status', type: 'string', description: 'A definition' }],
    [{ field_key: 'meaning', type: 'object', description: 'A definition' }],
    [{ field_key: 'meaning', type: 'string', description: '' }],
    [{ field_key: 'meaning', type: 'string', description: 'x'.repeat(301) }],
  ])('validates the request body: %j', async body => {
    const response = await POST(makeRequest(body), ROUTE_CONTEXT)

    expect(response.status).toBe(400)
    expect(createProviderMock).not.toHaveBeenCalled()
  })

  it('uses the configured AI provider and returns one instruction', async () => {
    suggestInstructionMock.mockResolvedValueOnce(
      'Return a concise definition in {output_language}. Return an empty string if the term has no clear definition.',
    )

    const response = await POST(makeRequest({
      field_key: 'meaning',
      type: 'string',
      description: 'A concise definition in the selected output language',
    }), ROUTE_CONTEXT)

    expect(response.status).toBe(200)
    expect(createProviderMock).toHaveBeenCalledWith({
      model: 'claude-sonnet-4-6',
      webSearchEnabled: true,
    })
    expect(suggestInstructionMock).toHaveBeenCalledWith({
      fieldKey: 'meaning',
      type: 'string',
      description: 'A concise definition in the selected output language',
    })
    expect(await response.json()).toEqual({
      instruction: 'Return a concise definition in {output_language}. Return an empty string if the term has no clear definition.',
    })
  })

  it('returns a 500 response when the provider fails', async () => {
    suggestInstructionMock.mockRejectedValueOnce(new Error('Provider unavailable'))

    const response = await POST(makeRequest({
      field_key: 'related_words',
      type: 'string_array',
      description: 'Related words',
    }), ROUTE_CONTEXT)

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Provider unavailable' })
  })
})
