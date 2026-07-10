import { beforeEach, describe, expect, it, vi } from 'vitest'

const { verifyMock, audioMock, globalSettings } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  audioMock: vi.fn(),
  globalSettings: { tts_available: true },
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminAuthInstance: () => ({ verifySessionCookie: verifyMock }),
  getAdminDb: () => ({
    collection: () => ({
      doc: () => ({
        get: async () => ({ data: () => ({ ...globalSettings }) }),
      }),
    }),
  }),
}))

vi.mock('@/lib/audio-service', () => ({
  generateAudioBase64: audioMock,
}))

import { POST } from '@/app/api/audio/generate/route'

const ROUTE_CONTEXT = { params: Promise.resolve({}) }

function makeRequest(body: unknown, authenticated = true): Request {
  return new Request('http://localhost:3000/api/audio/generate', {
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
  audioMock.mockReset()
  globalSettings.tts_available = true
  verifyMock.mockResolvedValue({ uid: 'user-1', email: 'user@example.com' })
})

describe('POST /api/audio/generate — customizable languages', () => {
  it('session がない → 401', async () => {
    const response = await POST(makeRequest({ text: 'bonjour', language: 'fr', filename: 'fr.mp3' }, false), ROUTE_CONTEXT)
    expect(response.status).toBe(401)
    expect(audioMock).not.toHaveBeenCalled()
  })

  it('管理者が TTS を無効化した場合 → 403', async () => {
    globalSettings.tts_available = false
    const response = await POST(makeRequest({ text: 'bonjour', language: 'fr', filename: 'fr.mp3' }), ROUTE_CONTEXT)
    expect(response.status).toBe(403)
    expect(audioMock).not.toHaveBeenCalled()
  })

  it('無効な BCP 47 language → 400', async () => {
    const response = await POST(makeRequest({
      text: 'bonjour',
      language: 'not a language',
      filename: 'fr.mp3',
    }), ROUTE_CONTEXT)
    expect(response.status).toBe(400)
    expect(audioMock).not.toHaveBeenCalled()
  })

  it('任意の BCP 47 language を canonicalize して TTS に渡す', async () => {
    audioMock.mockResolvedValueOnce('Ym9uam91cg==')
    const response = await POST(makeRequest({
      text: 'olá',
      language: 'pt_br',
      filename: 'pt.mp3',
    }), ROUTE_CONTEXT)

    expect(response.status).toBe(200)
    expect(audioMock).toHaveBeenCalledWith('olá', 'pt-BR')
    expect(await response.json()).toEqual({
      success: true,
      base64: 'Ym9uam91cg==',
      filename: 'pt.mp3',
    })
  })
})
