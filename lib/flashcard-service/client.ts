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

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '[::1]'
    || hostname === '::1'
}

/**
 * デプロイ版 origin (loopback 以外) から loopback の AnkiConnect を呼ぶ状況かを判定する。
 * ブラウザの Local Network Access / Private Network Access はこの public→localhost を
 * ブロックし、失敗は「Anki 未起動」と同じ `TypeError: Failed to fetch` になって区別できない —
 * そこで throw された error ではなく実行コンテキストから推測する。
 */
export function isLocalNetworkBlockedContext(
  ankiUrl: string = DEFAULT_ANKI_CONNECT_URL,
  pageHostname: string | undefined =
    typeof window !== 'undefined' ? window.location.hostname : undefined,
): boolean {
  if (!pageHostname || isLoopbackHost(pageHostname)) return false
  try {
    return isLoopbackHost(new URL(ankiUrl).hostname)
  } catch {
    return true
  }
}

/** AnkiConnect 接続失敗時のユーザー向けメッセージ — 実行コンテキストに応じて出し分ける。 */
export function ankiConnectionErrorMessage(
  ankiUrl: string = DEFAULT_ANKI_CONNECT_URL,
  pageHostname: string | undefined =
    typeof window !== 'undefined' ? window.location.hostname : undefined,
): string {
  return isLocalNetworkBlockedContext(ankiUrl, pageHostname)
    ? 'Cannot reach Anki. Your browser blocks a deployed site from accessing localhost (Local Network Access). Open AnkiFlow at http://localhost:3000 to sync with Anki, or allow local network access for this site.'
    : 'Cannot connect to AnkiConnect. Make sure Anki Desktop is open.'
}
