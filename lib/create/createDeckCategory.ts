/**
 * createDeckCategory.ts
 * Create ページ内で直接 Category / Anki Deck をすばやく作成するための helper
 * (admin に移動する必要がない)。DeckManager/CategoryManager のパターン
 * (client SDK + AnkiConnect 同期) を再利用。
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { getAnkiClientFromSettings } from '@/lib/flashcard-service/client'
import { ensureDeck, setDeckSuspended } from '@/lib/flashcard-service/client-ops'
import { FormType, LanguageType } from '@/types'

/** ログイン中のユーザーの UID — 未ログインなら throw (middleware がアプリ内で発生しないことを保証)。 */
function requireUid(): string {
  const uid = (auth as { currentUser?: { uid?: string } | null }).currentUser?.uid
  if (!uid) throw new Error('Not signed in')
  return uid
}

const LANGUAGE_DECK_PREFIX: Record<string, string> = {
  [LanguageType.ENGLISH]: 'English',
  [LanguageType.CHINESE]: 'Chinese',
  [LanguageType.JAPANESE]: 'Japanese',
}

/**
 * form_type/言語に基づいて階層的な (`::`) Anki deck 名を提案し、deck ツリーを
 * 統一する。純粋関数 — テストしやすい。
 */
export function suggestAnkiDeckName(
  displayName: string,
  formType: FormType | string,
  language?: LanguageType | string | null,
): string {
  const name = displayName.trim()
  if (!name) return ''
  if (formType === FormType.LANGUAGE) {
    const prefix = language ? LANGUAGE_DECK_PREFIX[language as string] : undefined
    return prefix ? `${prefix}::${name}` : name
  }
  if (formType === FormType.IT) return `IT::${name}`
  if (formType === FormType.GENERAL) return `General::${name}`
  return name
}

export interface CreatedCategory {
  id: string
  name: string
}

/** 新しい category を作成 (name + form_type のみ必要)。 */
export async function createCategory(params: {
  name: string
  formType: FormType
}): Promise<CreatedCategory> {
  const name = params.name.trim()
  const ref = await addDoc(collection(db, 'categories'), {
    user_id: requireUid(),
    name,
    form_type: params.formType,
    sort_order: 0,
    is_active: true,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  })
  return { id: ref.id, name }
}

export interface CreatedDeck {
  id: string
  display_name: string
  anki_deck_name: string
  /** AnkiConnect の同期が失敗した場合 true (例 Anki がまだ開いていない)。 */
  ankiSyncFailed: boolean
}

/**
 * 新しい deck を作成: Firestore に保存 + Anki と同期 (ensure + unsuspend)。
 * Anki が利用不可でも → アプリへの保存は継続し、`ankiSyncFailed = true` を返す。
 */
export async function createDeck(params: {
  displayName: string
  ankiDeckName: string
  formType: FormType | string
  language?: LanguageType | string | null
}): Promise<CreatedDeck> {
  const display_name = params.displayName.trim()
  const anki_deck_name = params.ankiDeckName.trim()

  const ref = await addDoc(collection(db, 'decks'), {
    user_id: requireUid(),
    anki_deck_name,
    display_name,
    form_type: params.formType,
    ...(params.language ? { language: params.language } : {}),
    is_active: true,
    sort_order: 0,
    default_card_type_ids: [],
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  })

  let ankiSyncFailed = false
  try {
    // Anki を client-side で同期 (browser → ユーザーの AnkiConnect)、DeckManager と同様。
    const client = await getAnkiClientFromSettings()
    await ensureDeck(client, anki_deck_name)
    await setDeckSuspended(client, anki_deck_name, false)
  } catch (e) {
    console.warn('AnkiConnect sync failed when creating deck:', e)
    ankiSyncFailed = true
  }

  return { id: ref.id, display_name, anki_deck_name, ankiSyncFailed }
}
