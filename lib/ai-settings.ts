import { getAdminDb } from '@/lib/firebase-admin'
import { GLOBAL_SETTINGS_DOC_ID, SETTINGS_DOC_ID } from '@/lib/constants'

export interface AISettings {
  model: string | null
  webSearchEnabled: boolean
}

// 管理者設定の反映は最大 60 秒遅延する。serverless instance ごとの短期 cache で十分。
const AI_SETTINGS_TTL_MS = 60_000
let cache: { value: AISettings; expiresAt: number } | null = null

/** Read app-owner AI controls; user preferences must never override API cost controls. */
export async function readAISettings(): Promise<AISettings> {
  if (cache && Date.now() < cache.expiresAt) return cache.value

  try {
    const db = getAdminDb()
    let snapshot = await db.collection('settings').doc(GLOBAL_SETTINGS_DOC_ID).get()
    if (!snapshot.exists) snapshot = await db.collection('settings').doc(SETTINGS_DOC_ID).get()
    const data = snapshot.data()
    const value: AISettings = {
      model: (data?.ai_model as string | undefined) ?? null,
      webSearchEnabled: (data?.web_search_enabled as boolean | undefined) ?? false,
    }
    cache = { value, expiresAt: Date.now() + AI_SETTINGS_TTL_MS }
    return value
  } catch (error) {
    console.warn('Could not read AI settings, using defaults:', error)
    return { model: null, webSearchEnabled: false }
  }
}

/** テスト専用: module-level cache を初期化する。 */
export function __clearAISettingsCache(): void {
  cache = null
}
