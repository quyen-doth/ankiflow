import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FormType } from '@/types'
import type { HistoryEntrySummary } from '@/lib/history/historyDto'

const { pushMock, loadContentTypesMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  loadContentTypesMock: vi.fn(async () => []),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { uid: 'uid-1', email: 'user@example.test' },
    loading: false,
  }),
}))

vi.mock('@/components/providers/StudyLanguageProvider', () => ({
  useStudyLanguages: () => ({ languages: [] }),
}))

vi.mock('@/lib/userContentTypes', () => ({
  loadUserContentTypes: loadContentTypesMock,
}))

vi.mock('@/hooks/useEntryEdit', () => ({
  useEntryEdit: () => ({ saveEntry: vi.fn() }),
}))

vi.mock('@/hooks/useEntryDelete', () => ({
  useEntryDelete: () => ({ deleteEntries: vi.fn() }),
}))

vi.mock('@/components/ui/MotionPage', () => ({
  MotionPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import HistoryPage from '@/app/history/page'

function summary(
  id: string,
  word: string,
  status: HistoryEntrySummary['status'] = 'draft',
): HistoryEntrySummary {
  return {
    id,
    form_type: FormType.LANGUAGE,
    language: 'en',
    word,
    meaning_vi: `${word} meaning`,
    anki_deck: 'Default',
    anki_note_ids: [],
    card_count: 2,
    status,
    created_at: '2026-07-25T00:00:00.000Z',
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function flush(ms = 0): Promise<void> {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, ms))
  })
}

describe('History page API pagination', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    pushMock.mockReset()
    loadContentTypesMock.mockClear()
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('initial summary page を表示し Load more で cursor page を追記する', async () => {
    const requestedUrls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      requestedUrls.push(url)
      if (url === '/api/history/facets') {
        return jsonResponse({ form_types: [FormType.LANGUAGE], languages: ['en'] })
      }
      if (url.includes('cursor=cursor-2')) {
        return jsonResponse({
          entries: [summary('entry-2', 'Second')],
          total: 2,
          next_cursor: null,
        })
      }
      return jsonResponse({
        entries: [summary('entry-1', 'First')],
        total: 2,
        next_cursor: 'cursor-2',
      })
    }))

    await act(async () => root.render(<HistoryPage />))
    await flush()
    await flush()

    expect(container.textContent).toContain('First')
    expect(container.textContent).toContain('1/2 cards loaded · 2 notes')
    const loadMore = container.querySelector<HTMLButtonElement>(
      'button[title="Load more cards"]',
    )
    expect(loadMore).not.toBeNull()

    await act(async () => loadMore?.click())
    await flush()

    expect(container.textContent).toContain('First')
    expect(container.textContent).toContain('Second')
    expect(container.textContent).toContain('2/2 cards loaded · 4 notes')
    expect(container.querySelector('button[title="Load more cards"]')).toBeNull()
    expect(requestedUrls).toContain('/api/history?limit=50')
    expect(requestedUrls).toContain(
      '/api/history?limit=50&cursor=cursor-2',
    )
  })

  it('filter change で stale request を abort し、新しい response だけを表示する', async () => {
    let resolveInitial: ((response: Response) => void) | undefined
    let initialSignal: AbortSignal | undefined
    vi.stubGlobal('fetch', vi.fn((
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url = String(input)
      if (url === '/api/history/facets') {
        return Promise.resolve(jsonResponse({ form_types: [], languages: [] }))
      }
      if (url.includes('status=synced')) {
        return Promise.resolve(jsonResponse({
          entries: [summary('synced', 'Newest synced', 'synced')],
          total: 1,
          next_cursor: null,
        }))
      }
      initialSignal = init?.signal ?? undefined
      return new Promise<Response>(resolve => {
        resolveInitial = resolve
      })
    }))

    await act(async () => root.render(<HistoryPage />))
    await flush()
    const status = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Status"]',
    )
    expect(status).not.toBeNull()

    await act(async () => {
      if (!status) return
      status.value = 'synced'
      status.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await flush()

    expect(initialSignal?.aborted).toBe(true)
    expect(container.textContent).toContain('Newest synced')

    resolveInitial?.(jsonResponse({
      entries: [summary('stale', 'Stale draft')],
      total: 1,
      next_cursor: null,
    }))
    await flush()

    expect(container.textContent).not.toContain('Stale draft')
    expect(container.textContent).toContain('Newest synced')
  })

  it('Edit click で summary row から full Entry を on-demand 読み込む', async () => {
    const requestedUrls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      requestedUrls.push(url)
      if (url === '/api/history/facets') {
        return jsonResponse({ form_types: [], languages: [] })
      }
      if (url === '/api/history/entry-1') {
        return jsonResponse({
          entry: {
            ...summary('entry-1', 'Editable'),
            user_id: 'uid-1',
            category_id: null,
            card_type_ids: [],
            tags: [],
            example_sentence: 'Full entry example',
          },
        })
      }
      return jsonResponse({
        entries: [summary('entry-1', 'Editable')],
        total: 1,
        next_cursor: null,
      })
    }))

    await act(async () => root.render(<HistoryPage />))
    await flush()
    await flush()
    const edit = container.querySelector<HTMLButtonElement>('button[title="Edit"]')

    await act(async () => edit?.click())
    await flush()

    expect(requestedUrls).toContain('/api/history/entry-1')
    expect(container.textContent).toContain('Edit Flashcard')
    expect(container.textContent).toContain('Full entry example')
  })
})
