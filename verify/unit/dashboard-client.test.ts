import { afterEach, describe, expect, it, vi } from 'vitest'
import {
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
})
