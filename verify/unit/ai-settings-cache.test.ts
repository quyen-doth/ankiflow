import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminDb: () => ({
    collection: () => ({
      doc: () => ({ get: getMock }),
    }),
  }),
}))

import { __clearAISettingsCache, readAISettings } from '@/lib/ai-settings'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-07-10T00:00:00Z'))
  getMock.mockReset()
  __clearAISettingsCache()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('readAISettings cache', () => {
  it('TTL 内の連続呼び出しは Firestore を 1 回だけ読む', async () => {
    getMock.mockResolvedValue({
      exists: true,
      data: () => ({ ai_model: 'claude-haiku-4-5', web_search_enabled: true }),
    })

    const first = await readAISettings()
    const second = await readAISettings()

    expect(first).toEqual({ model: 'claude-haiku-4-5', webSearchEnabled: true })
    expect(second).toEqual(first)
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('TTL 経過後は Firestore を再取得', async () => {
    getMock.mockResolvedValue({
      exists: true,
      data: () => ({ ai_model: 'claude-haiku-4-5', web_search_enabled: false }),
    })

    await readAISettings()
    vi.advanceTimersByTime(61_000)
    await readAISettings()

    expect(getMock).toHaveBeenCalledTimes(2)
  })

  it('Firestore error の default 値は cache せず次回 retry', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    getMock
      .mockRejectedValueOnce(new Error('Firestore unavailable'))
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ ai_model: 'claude-sonnet-4-6', web_search_enabled: false }),
      })

    expect(await readAISettings()).toEqual({ model: null, webSearchEnabled: false })
    expect(await readAISettings()).toEqual({ model: 'claude-sonnet-4-6', webSearchEnabled: false })
    expect(getMock).toHaveBeenCalledTimes(2)
  })
})
