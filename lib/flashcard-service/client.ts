/**
 * Client-side AnkiConnect — browser gọi thẳng AnkiConnect trên máy của CHÍNH user
 * (mặc định http://localhost:8765), thay vì đi qua API route server.
 *
 * Lý do: trên bản deploy (Vercel), localhost của server không phải máy user —
 * chỉ có browser của user mới chạm được Anki Desktop của họ.
 *
 * Yêu cầu phía user khi dùng bản deploy: thêm domain app vào `webCorsOriginList`
 * trong config của AnkiConnect addon (Tools → Add-ons → AnkiConnect → Config).
 */
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { SETTINGS_DOC_ID } from '@/lib/constants'
import { AnkiConnectProvider } from './anki-connect-provider'

export const DEFAULT_ANKI_CONNECT_URL = 'http://localhost:8765'

let cachedClient: { url: string; client: AnkiConnectProvider } | null = null
let cachedUrl: string | null = null

/** Instance AnkiConnect cho browser — cache theo URL. */
export function getAnkiClient(url: string = DEFAULT_ANKI_CONNECT_URL): AnkiConnectProvider {
  if (!cachedClient || cachedClient.url !== url) {
    cachedClient = { url, client: new AnkiConnectProvider(url) }
  }
  return cachedClient.client
}

/**
 * URL AnkiConnect từ `settings.anki_connect_url`, fallback default.
 * Cache trong session để poll 30s không tốn Firestore read mỗi lần —
 * sau khi user đổi URL trong Settings, gọi `resetAnkiClientCache()` để áp dụng.
 */
export async function resolveAnkiConnectUrl(): Promise<string> {
  if (cachedUrl) return cachedUrl
  try {
    const snap = await getDoc(doc(db, 'settings', SETTINGS_DOC_ID))
    const url = snap.exists()
      ? (snap.data() as { anki_connect_url?: string }).anki_connect_url?.trim()
      : undefined
    cachedUrl = url || DEFAULT_ANKI_CONNECT_URL
  } catch {
    cachedUrl = DEFAULT_ANKI_CONNECT_URL
  }
  return cachedUrl
}

/** Client AnkiConnect với URL đã resolve từ settings. */
export async function getAnkiClientFromSettings(): Promise<AnkiConnectProvider> {
  return getAnkiClient(await resolveAnkiConnectUrl())
}

export function resetAnkiClientCache(): void {
  cachedClient = null
  cachedUrl = null
}
