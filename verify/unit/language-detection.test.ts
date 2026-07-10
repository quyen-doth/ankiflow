import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectItemLanguages, formatMixedLanguageError } from '@/lib/create/languageDetection'

afterEach(() => {
  vi.restoreAllMocks()
})
describe('detectItemLanguages', () => {
  it('posts candidate languages and canonicalizes the response', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      expect(body).toEqual({
        items: ['olá'],
        candidate_languages: [{ code: 'pt-BR', display_name: 'Português' }],
      })
      return new Response(JSON.stringify({
        detections: [{ index: 0, code: 'pt_br', display_name: 'Portuguese', confidence: 0.91 }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await detectItemLanguages(
      ['olá'],
      [{ code: 'pt-BR', display_name: 'Português' }],
    )

    expect(result[0]).toEqual({
      index: 0,
      code: 'pt-BR',
      display_name: 'Portuguese',
      confidence: 0.91,
    })
  })

  it('surfaces API errors and rejects incomplete responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: 'Detector unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )))
    await expect(detectItemLanguages(['hello'], [])).rejects.toThrow('Detector unavailable')

    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ detections: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    await expect(detectItemLanguages(['hello'], [])).rejects.toThrow('incomplete')
  })
})

describe('formatMixedLanguageError', () => {
  it('returns null for a single-language batch', () => {
    expect(formatMixedLanguageError(['cat', 'dog'], [
      { index: 0, code: 'en', display_name: 'English', confidence: 0.9 },
      { index: 1, code: 'en', display_name: 'English', confidence: 0.9 },
    ])).toBeNull()
  })

  it('lists every item when a batch mixes languages', () => {
    const message = formatMixedLanguageError(['cat', '猫'], [
      { index: 0, code: 'en', display_name: 'English', confidence: 0.9 },
      { index: 1, code: 'ja', display_name: 'Japanese', confidence: 0.99 },
    ])
    expect(message).toContain('#1 “cat” → English (en)')
    expect(message).toContain('#2 “猫” → Japanese (ja)')
  })
})
