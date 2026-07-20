import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_ANKI_CONNECT_URL,
  getAnkiClient,
  getAnkiClientFromSettings,
  resetAnkiClientCache,
  resolveAnkiConnectUrl,
} from '@/lib/flashcard-service/client'
import { auth } from '@/lib/firebase'

// 検証用コメント。
const g = globalThis as unknown as {
  __verifyFirestoreSeed?: (data: Record<string, Record<string, unknown>[]>) => void
  __verifyFirestoreReset?: () => void
}

// 検証用コメント。
const mutableAuth = auth as unknown as { currentUser: { uid: string } | null }
const TEST_UID = 'test-user'

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
  mutableAuth.currentUser = { uid: TEST_UID }
  // 検証用コメント。
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  mutableAuth.currentUser = null
})

describe('getAnkiClient — cache theo URL', () => {
  it('同じ URL は同じ instance を返す', () => {
    const a = getAnkiClient()
    const b = getAnkiClient()
    expect(a).toBe(b)
  })

  it('異なる URL は新しい instance を作成', () => {
    const a = getAnkiClient()
    const b = getAnkiClient('http://127.0.0.1:9999')
    expect(a).not.toBe(b)
  })
})

describe('ping — browser が AnkiConnect を直接呼び出す', () => {
  it('AnkiConnect が version 6 を返す → connected、正しい URL + action を呼ぶ', async () => {
    const mock = stubFetchJson({ result: 6, error: null })

    const result = await getAnkiClient().ping()

    expect(result).toEqual({ connected: true, version: 6 })
    const [url, init] = mock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(DEFAULT_ANKI_CONNECT_URL)
    expect(JSON.parse(init.body as string)).toEqual({ action: 'version', version: 6, params: {} })
  })

  it('fetch がネットワークエラーを投げる (Anki が閉じている) → connected: false、throw しない', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))

    await expect(getAnkiClient().ping()).resolves.toEqual({ connected: false })
  })

  it('AnkiConnect が error field を返す → invoke は AnkiConnect の message で throw', async () => {
    stubFetchJson({ result: null, error: 'collection is not available' })

    await expect(getAnkiClient().getDecks()).rejects.toThrow('collection is not available')
  })
})

describe('resolveAnkiConnectUrl — settings/{uid} を読み込み、cache、fallback', () => {
  it('settings/{uid} の anki_connect_url を使用', async () => {
    g.__verifyFirestoreSeed?.({
      settings: [{ id: TEST_UID, anki_connect_url: 'http://127.0.0.1:9999' }],
    })

    await expect(resolveAnkiConnectUrl()).resolves.toBe('http://127.0.0.1:9999')
  })

  it('user の settings doc がない → デフォルト URL にフォールバック', async () => {
    await expect(resolveAnkiConnectUrl()).resolves.toBe(DEFAULT_ANKI_CONNECT_URL)
  })

  it('settings/default はもう読まない (ユーザーごとのみ) → settings/default に url があってもデフォルト', async () => {
    // 検証用コメント。
    g.__verifyFirestoreSeed?.({
      settings: [{ id: 'default', anki_connect_url: 'http://127.0.0.1:9999' }],
    })

    await expect(resolveAnkiConnectUrl()).resolves.toBe(DEFAULT_ANKI_CONNECT_URL)
  })

  it('未ログイン (currentUser null) → デフォルト URL、Firestore を読まない', async () => {
    mutableAuth.currentUser = null
    g.__verifyFirestoreSeed?.({
      settings: [{ id: TEST_UID, anki_connect_url: 'http://127.0.0.1:9999' }],
    })

    await expect(resolveAnkiConnectUrl()).resolves.toBe(DEFAULT_ANKI_CONNECT_URL)
  })

  it('解決済み URL を cache; resetAnkiClientCache() が cache をクリア', async () => {
    g.__verifyFirestoreSeed?.({
      settings: [{ id: TEST_UID, anki_connect_url: 'http://127.0.0.1:9999' }],
    })
    await resolveAnkiConnectUrl()

    // 検証用コメント。
    g.__verifyFirestoreReset?.()
    await expect(resolveAnkiConnectUrl()).resolves.toBe('http://127.0.0.1:9999')

    // 検証用コメント。
    resetAnkiClientCache()
    await expect(resolveAnkiConnectUrl()).resolves.toBe(DEFAULT_ANKI_CONNECT_URL)
  })

  it('getAnkiClientFromSettings は settings/{uid} からの正しい URL で ping', async () => {
    g.__verifyFirestoreSeed?.({
      settings: [{ id: TEST_UID, anki_connect_url: 'http://127.0.0.1:9999' }],
    })
    const mock = stubFetchJson({ result: 6, error: null })

    const client = await getAnkiClientFromSettings()
    await client.ping()

    expect((mock.mock.calls[0] as unknown as [string, RequestInit])[0]).toBe('http://127.0.0.1:9999')
  })
})
