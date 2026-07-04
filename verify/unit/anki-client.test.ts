import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_ANKI_CONNECT_URL,
  getAnkiClient,
  getAnkiClientFromSettings,
  resetAnkiClientCache,
  resolveAnkiConnectUrl,
} from '@/lib/flashcard-service/client'

// Seed/reset store của firestore-stub qua global hooks (xem verify/harness/firestore-stub.ts)
const g = globalThis as unknown as {
  __verifyFirestoreSeed?: (data: Record<string, Record<string, unknown>[]>) => void
  __verifyFirestoreReset?: () => void
}

function stubFetchJson(body: unknown) {
  const mock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
  vi.stubGlobal('fetch', mock)
  return mock
}

beforeEach(() => {
  resetAnkiClientCache()
  g.__verifyFirestoreReset?.()
  // invoke() log console.error khi fail — im lặng để output test sạch
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('getAnkiClient — cache theo URL', () => {
  it('cùng URL trả về cùng instance', () => {
    const a = getAnkiClient()
    const b = getAnkiClient()
    expect(a).toBe(b)
  })

  it('URL khác tạo instance mới', () => {
    const a = getAnkiClient()
    const b = getAnkiClient('http://127.0.0.1:9999')
    expect(a).not.toBe(b)
  })
})

describe('ping — browser gọi thẳng AnkiConnect', () => {
  it('AnkiConnect trả version 6 → connected, gọi đúng URL + action', async () => {
    const mock = stubFetchJson({ result: 6, error: null })

    const result = await getAnkiClient().ping()

    expect(result).toEqual({ connected: true, version: 6 })
    const [url, init] = mock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(DEFAULT_ANKI_CONNECT_URL)
    expect(JSON.parse(init.body as string)).toEqual({ action: 'version', version: 6, params: {} })
  })

  it('fetch ném lỗi mạng (Anki đóng) → connected: false, không throw', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))

    await expect(getAnkiClient().ping()).resolves.toEqual({ connected: false })
  })

  it('AnkiConnect trả error field → invoke throw với message của AnkiConnect', async () => {
    stubFetchJson({ result: null, error: 'collection is not available' })

    await expect(getAnkiClient().getDecks()).rejects.toThrow('collection is not available')
  })
})

describe('resolveAnkiConnectUrl — đọc settings, cache, fallback', () => {
  it('dùng anki_connect_url từ settings doc', async () => {
    g.__verifyFirestoreSeed?.({
      settings: [{ id: 'default', anki_connect_url: 'http://127.0.0.1:9999' }],
    })

    await expect(resolveAnkiConnectUrl()).resolves.toBe('http://127.0.0.1:9999')
  })

  it('không có settings doc → fallback default URL', async () => {
    await expect(resolveAnkiConnectUrl()).resolves.toBe(DEFAULT_ANKI_CONNECT_URL)
  })

  it('cache URL đã resolve; resetAnkiClientCache() xóa cache', async () => {
    g.__verifyFirestoreSeed?.({
      settings: [{ id: 'default', anki_connect_url: 'http://127.0.0.1:9999' }],
    })
    await resolveAnkiConnectUrl()

    // Store đổi nhưng cache còn → vẫn URL cũ
    g.__verifyFirestoreReset?.()
    await expect(resolveAnkiConnectUrl()).resolves.toBe('http://127.0.0.1:9999')

    // Reset cache → đọc lại từ settings (giờ trống) → default
    resetAnkiClientCache()
    await expect(resolveAnkiConnectUrl()).resolves.toBe(DEFAULT_ANKI_CONNECT_URL)
  })

  it('getAnkiClientFromSettings ping đúng URL từ settings', async () => {
    g.__verifyFirestoreSeed?.({
      settings: [{ id: 'default', anki_connect_url: 'http://127.0.0.1:9999' }],
    })
    const mock = stubFetchJson({ result: 6, error: null })

    const client = await getAnkiClientFromSettings()
    await client.ping()

    expect((mock.mock.calls[0] as [string, RequestInit])[0]).toBe('http://127.0.0.1:9999')
  })
})
