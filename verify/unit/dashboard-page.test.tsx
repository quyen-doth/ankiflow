import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FormType } from '@/types'

const { pushMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
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
  useStudyLanguages: () => ({
    languages: [
      { code: 'en', display_name: 'English', enabled: true, sort_order: 0 },
      { code: 'ja', display_name: 'Japanese', enabled: true, sort_order: 1 },
    ],
    enabledLanguages: [
      { code: 'en', display_name: 'English', enabled: true, sort_order: 0 },
      { code: 'ja', display_name: 'Japanese', enabled: true, sort_order: 1 },
    ],
    loading: false,
  }),
}))

vi.mock('@/components/ui/MotionPage', () => ({
  MotionPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import DashboardPage from '@/app/dashboard/page'

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

describe('Dashboard page API flow', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    pushMock.mockReset()
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('aggregate stats、language breakdown、6 件以下の recent summary を表示する', async () => {
    const requestedUrls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      requestedUrls.push(String(input))
      return jsonResponse({
        stats: {
          total_vocabulary: 120,
          total_cards: 245,
          created_today: 7,
          synced: 90,
        },
        language_counts: [
          { language: 'en', count: 30 },
          { language: 'ja', count: 10 },
        ],
        recent_entries: [
          {
            id: 'entry-1',
            form_type: FormType.LANGUAGE,
            language: 'ja',
            word: '流れ',
            meaning_vi: 'flow',
            status: 'synced',
          },
        ],
      })
    }))

    await act(async () => root.render(<DashboardPage />))
    await flush()
    await flush()

    const text = container.textContent ?? ''
    expect(text).toContain('120')
    expect(text).toContain('245')
    expect(text).toContain('7')
    expect(text).toContain('75%')
    expect(text).toContain('流れ')
    expect(text).toContain('English')
    expect(text).toContain('Japanese')
    expect(requestedUrls).toHaveLength(1)
    const url = new URL(requestedUrls[0], 'https://example.test')
    expect(url.pathname).toBe('/api/dashboard')
    expect(url.searchParams.getAll('language')).toEqual(['en', 'ja'])
    const start = new Date(url.searchParams.get('day_start') ?? '')
    const end = new Date(url.searchParams.get('day_end') ?? '')
    const durationHours = (end.getTime() - start.getTime()) / (60 * 60 * 1_000)
    expect(durationHours).toBeGreaterThanOrEqual(22)
    expect(durationHours).toBeLessThanOrEqual(26)
  })

  it('API failure でも loading を解除して empty dashboard として安全に表示する', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => (
      jsonResponse({ error: 'Dashboard unavailable' }, 500)
    )))

    await act(async () => root.render(<DashboardPage />))
    await flush(20)

    expect(container.textContent).toContain('No cards yet')
    expect(container.textContent).toContain('No language vocabulary yet')
    expect(container.querySelector('.animate-spin')).toBeNull()
    const statValues = Array.from(
      container.querySelectorAll('[data-verify-unit="StatCard"]'),
      element => element.getAttribute('data-verify-value'),
    )
    expect(statValues).toEqual(['0', '0', '0', '0%'])
  })
})
