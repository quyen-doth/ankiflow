import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveTermsForTarget } from '@/lib/create/termResolution'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resolveTermsForTarget', () => {
  it('posts the target language and canonicalizes the source language', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body))
      expect(body).toEqual({
        items: ['water'],
        target_language: { code: 'ja', display_name: 'Japanese' },
      })
      return new Response(JSON.stringify({
        resolutions: [
          { index: 0, resolved_term: '水', source_language: 'en_us', was_translated: true },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await resolveTermsForTarget(['water'], { code: 'ja', display_name: 'Japanese' })

    expect(result[0]).toEqual({
      index: 0,
      resolved_term: '水',
      source_language: 'en-US',
      was_translated: true,
    })
  })

  it('surfaces API errors and rejects incomplete responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: 'Resolver unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    )))
    await expect(
      resolveTermsForTarget(['water'], { code: 'ja', display_name: 'Japanese' }),
    ).rejects.toThrow('Resolver unavailable')

    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ resolutions: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    await expect(
      resolveTermsForTarget(['water'], { code: 'ja', display_name: 'Japanese' }),
    ).rejects.toThrow('incomplete')
  })

  it('rejects an invalid source language code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({
        resolutions: [
          { index: 0, resolved_term: '水', source_language: 'not a language', was_translated: true },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    await expect(
      resolveTermsForTarget(['water'], { code: 'ja', display_name: 'Japanese' }),
    ).rejects.toThrow('Invalid source language code')
  })
})
