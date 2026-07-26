import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DASHBOARD_LANGUAGE_BATCH_SIZE,
  buildDashboardUrl,
  localDayBounds,
  requestDashboard,
} from '@/lib/dashboard/dashboardClient'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Dashboard client', () => {
  it('browser local calendar から半開区間 [dayStart, dayEnd) を作る', () => {
    const now = new Date(2026, 6, 26, 15, 30, 0)
    const bounds = localDayBounds(now)
    const start = new Date(bounds.dayStart)
    const end = new Date(bounds.dayEnd)

    expect([
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
      start.getHours(),
      start.getMinutes(),
    ]).toEqual([2026, 6, 26, 0, 0])
    expect([
      end.getFullYear(),
      end.getMonth(),
      end.getDate(),
      end.getHours(),
      end.getMinutes(),
    ]).toEqual([2026, 6, 27, 0, 0])
    expect(end.getTime()).toBeGreaterThan(start.getTime())
  })

  it('day bounds と canonical/deduped language を API URL に encode する', () => {
    const url = buildDashboardUrl({
      dayStart: '2026-07-26T00:00:00.000Z',
      dayEnd: '2026-07-27T00:00:00.000Z',
    }, ['ja_JP', 'ja-JP', 'en', 'bad_code!'])
    const parsed = new URL(url, 'https://example.test')

    expect(parsed.pathname).toBe('/api/dashboard')
    expect(parsed.searchParams.get('day_start')).toBe('2026-07-26T00:00:00.000Z')
    expect(parsed.searchParams.get('day_end')).toBe('2026-07-27T00:00:00.000Z')
    expect(parsed.searchParams.getAll('language')).toEqual(['ja-JP', 'en'])
  })

  it('API response を返し、server/contract error を明示する', async () => {
    const responseBody = {
      stats: {
        total_vocabulary: 4,
        total_cards: 7,
        created_today: 1,
        synced: 2,
      },
      language_counts: [],
      recent_entries: [],
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(responseBody), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Invalid query parameters' }), {
        status: 400,
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ stats: responseBody.stats }), {
        status: 200,
      }))
    vi.stubGlobal('fetch', fetchMock)
    const signal = new AbortController().signal
    const bounds = {
      dayStart: '2026-07-26T00:00:00.000Z',
      dayEnd: '2026-07-27T00:00:00.000Z',
    }

    await expect(requestDashboard(bounds, [], signal)).resolves.toEqual(responseBody)
    await expect(requestDashboard(bounds, [], signal))
      .rejects.toThrow('Invalid query parameters')
    await expect(requestDashboard(bounds, [], signal))
      .rejects.toThrow('Invalid dashboard response')
  })

  it('20 件を超える有効言語を bounded sequential request に分割して全 count を統合する', async () => {
    const languages = [
      'en', 'ja', 'zh', 'fr', 'de',
      'es', 'it', 'pt', 'ru', 'ko',
      'ar', 'hi', 'nl', 'sv', 'no',
      'da', 'fi', 'pl', 'tr', 'cs',
      'el', 'he', 'id', 'vi', 'th',
    ]
    const requestedUrls: string[] = []
    let resolveFirst: ((response: Response) => void) | undefined
    const responseFor = (url: string) => {
      const requestedLanguages = new URL(url, 'https://example.test')
        .searchParams.getAll('language')
      return new Response(JSON.stringify({
        stats: {
          total_vocabulary: 25,
          total_cards: 50,
          created_today: 1,
          synced: 20,
        },
        language_counts: requestedLanguages.map((language, index) => ({
          language,
          count: index + 1,
        })),
        recent_entries: [{ id: 'recent-entry', status: 'synced' }],
      }), { status: 200 })
    }
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)
      requestedUrls.push(url)
      if (requestedUrls.length === 1) {
        return new Promise<Response>(resolve => {
          resolveFirst = resolve
        })
      }
      return Promise.resolve(responseFor(url))
    })
    vi.stubGlobal('fetch', fetchMock)
    const bounds = {
      dayStart: '2026-07-26T00:00:00.000Z',
      dayEnd: '2026-07-27T00:00:00.000Z',
    }

    const resultPromise = requestDashboard(
      bounds,
      [...languages, 'en', 'bad_code!'],
      new AbortController().signal,
    )
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    resolveFirst?.(responseFor(requestedUrls[0]))
    const result = await resultPromise
    const batches = requestedUrls.map(url => (
      new URL(url, 'https://example.test').searchParams.getAll('language')
    ))

    expect(batches.map(batch => batch.length)).toEqual([
      DASHBOARD_LANGUAGE_BATCH_SIZE,
      5,
    ])
    expect(batches.flat()).toEqual(languages)
    expect(result.language_counts.map(item => item.language)).toEqual(languages)
    expect(result.stats.total_vocabulary).toBe(25)
    expect(result.recent_entries).toHaveLength(1)
  })

  it('後続 language batch の失敗を partial dashboard として隠さない', async () => {
    const languages = [
      'en', 'ja', 'zh', 'fr', 'de',
      'es', 'it', 'pt', 'ru', 'ko',
      'ar', 'hi', 'nl', 'sv', 'no',
      'da', 'fi', 'pl', 'tr', 'cs',
      'el',
    ]
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        stats: {
          total_vocabulary: 21,
          total_cards: 42,
          created_today: 1,
          synced: 20,
        },
        language_counts: [],
        recent_entries: [],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: 'Dashboard language batch failed',
      }), { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(requestDashboard({
      dayStart: '2026-07-26T00:00:00.000Z',
      dayEnd: '2026-07-27T00:00:00.000Z',
    }, languages, new AbortController().signal))
      .rejects.toThrow('Dashboard language batch failed')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
