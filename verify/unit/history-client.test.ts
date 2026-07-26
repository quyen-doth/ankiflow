import { afterEach, describe, expect, it, vi } from 'vitest'
import { FormType } from '@/types'
import {
  buildHistoryListUrl,
  requestHistory,
} from '@/lib/history/historyClient'
import {
  applyHistorySummaryUpdates,
  type HistoryEntrySummary,
} from '@/lib/history/historyDto'
import {
  ALL_HISTORY_FILTERS,
  DEFAULT_HISTORY_FILTERS,
} from '@/lib/history/filterEntries'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('History client', () => {
  it('active filters と cursor だけを list URL に含める', () => {
    const url = buildHistoryListUrl({
      search: '  event loop  ',
      contentType: FormType.LANGUAGE,
      language: 'ja-JP',
      status: 'reviewed',
    }, 'cursor/value')
    const parsed = new URL(url, 'https://example.test')

    expect(parsed.pathname).toBe('/api/history')
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      limit: '50',
      keyword: 'event loop',
      form_type: FormType.LANGUAGE,
      language: 'ja-JP',
      status: 'reviewed',
      cursor: 'cursor/value',
    })
    expect(buildHistoryListUrl({
      ...DEFAULT_HISTORY_FILTERS,
      language: 'en',
      contentType: FormType.IT,
    })).not.toContain('language=')
    expect(buildHistoryListUrl(DEFAULT_HISTORY_FILTERS))
      .toBe('/api/history?limit=50')
  })

  it('response contract を安全な default に正規化し API error を伝える', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        entries: [],
        total: 7,
        next_cursor: 'next',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: 'Invalid cursor',
      }), { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await expect(requestHistory(
      {
        ...DEFAULT_HISTORY_FILTERS,
        status: ALL_HISTORY_FILTERS,
      },
      undefined,
      controller.signal,
    )).resolves.toEqual({
      entries: [],
      total: 7,
      next_cursor: 'next',
    })
    await expect(requestHistory(
      DEFAULT_HISTORY_FILTERS,
      'invalid',
      controller.signal,
    )).rejects.toThrow('Invalid cursor')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('History summary updates', () => {
  it('list DTO で表示する field だけを edit response から反映する', () => {
    const summary: HistoryEntrySummary = {
      id: 'entry-1',
      form_type: FormType.LANGUAGE,
      word: 'before',
      meaning_vi: 'old meaning',
      anki_deck: 'Default',
      anki_note_ids: [],
      card_count: 2,
      status: 'reviewed',
      created_at: null,
    }

    expect(applyHistorySummaryUpdates(summary, {
      word: 'after',
      meaning_vi: 'new meaning',
      audio_url: 'data:audio/must-not-enter-summary',
    })).toEqual({
      ...summary,
      word: 'after',
      meaning_vi: 'new meaning',
    })
  })
})
