import { getAdminDb } from '@/lib/firebase-admin'
import { GLOBAL_SETTINGS_DOC_ID, SETTINGS_DOC_ID } from '@/lib/constants'

export interface AISettings {
  model: string | null
  webSearchEnabled: boolean
}
/** Read app-owner AI controls; user preferences must never override API cost controls. */
export async function readAISettings(): Promise<AISettings> {
  try {
    const db = getAdminDb()
    let snapshot = await db.collection('settings').doc(GLOBAL_SETTINGS_DOC_ID).get()
    if (!snapshot.exists) snapshot = await db.collection('settings').doc(SETTINGS_DOC_ID).get()
    const data = snapshot.data()
    return {
      model: (data?.ai_model as string | undefined) ?? null,
      webSearchEnabled: (data?.web_search_enabled as boolean | undefined) ?? false,
    }
  } catch (error) {
    console.warn('Could not read AI settings, using defaults:', error)
    return { model: null, webSearchEnabled: false }
  }
}
