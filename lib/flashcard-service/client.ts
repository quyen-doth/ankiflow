/**
 * Client-side AnkiConnect — ブラウザがサーバー API route を経由せず、ユーザー自身の
 * マシン上の AnkiConnect (デフォルト http://localhost:8765) を直接呼び出す。
 *
 * 理由: デプロイ版 (Vercel) 上では、サーバーの localhost はユーザーのマシンではない —
 * ユーザーのブラウザのみが自分の Anki Desktop に到達できる。
 *
 * デプロイ版使用時にユーザー側で必要な作業: AnkiConnect アドオンの config
 * (Tools → Add-ons → AnkiConnect → Config) にアプリの domain を
 * `webCorsOriginList` へ追加すること。
 */
import { doc, getDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { AnkiConnectProvider } from './anki-connect-provider'

export const DEFAULT_ANKI_CONNECT_URL = 'http://localhost:8765'

let cachedClient: { url: string; client: AnkiConnectProvider } | null = null
let cachedUrl: string | null = null

/** ブラウザ用の AnkiConnect インスタンス — URL ごとにキャッシュ。 */
export function getAnkiClient(url: string = DEFAULT_ANKI_CONNECT_URL): AnkiConnectProvider {
  if (!cachedClient || cachedClient.url !== url) {
    cachedClient = { url, client: new AnkiConnectProvider(url) }
  }
  return cachedClient.client
}

/**
 * ユーザーの settings (`settings/{uid}.anki_connect_url`) から AnkiConnect URL を取得、
 * doc `default` (古いデータ) にフォールバック、最終フォールバックは localhost:8765。
 * 30 秒ごとの poll のたびに Firestore read が発生しないよう session 内でキャッシュ —
 * ユーザーが Settings で URL を変更した後は `resetAnkiClientCache()` を呼んで反映する。
 */
export async function resolveAnkiConnectUrl(): Promise<string> {
  if (cachedUrl) return cachedUrl
  try {
    // settings/{uid} (ユーザーごと) のみを読む。settings/default にはフォールバックしない:
    // そのドキュメントはアプリ所有者の secrets — Security Rules が非管理者の読み取りを
    // ブロックしており、もう anki_connect_url も含まれていない。フィールドがなければ
    // デフォルト定数を使用。
    const uid = (auth as { currentUser?: { uid?: string } | null }).currentUser?.uid
    let url: string | undefined
    if (uid) {
      const userSnap = await getDoc(doc(db, 'settings', uid))
      if (userSnap.exists()) {
        url = (userSnap.data() as { anki_connect_url?: string }).anki_connect_url?.trim()
      }
    }
    cachedUrl = url || DEFAULT_ANKI_CONNECT_URL
  } catch {
    cachedUrl = DEFAULT_ANKI_CONNECT_URL
  }
  return cachedUrl
}

/** settings から解決した URL を持つ AnkiConnect Client。 */
export async function getAnkiClientFromSettings(): Promise<AnkiConnectProvider> {
  return getAnkiClient(await resolveAnkiConnectUrl())
}

export function resetAnkiClientCache(): void {
  cachedClient = null
  cachedUrl = null
}
