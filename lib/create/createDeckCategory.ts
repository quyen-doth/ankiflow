/**
 * createDeckCategory.ts
 * Helper tạo nhanh Category / Anki Deck ngay trong trang Create (không cần sang admin).
 * Tái dùng pattern của DeckManager/CategoryManager (client SDK + đồng bộ AnkiConnect).
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { FormType, LanguageType } from '@/types'

const LANGUAGE_DECK_PREFIX: Record<string, string> = {
  [LanguageType.ENGLISH]: 'English',
  [LanguageType.CHINESE]: 'Chinese',
  [LanguageType.JAPANESE]: 'Japanese',
}

/**
 * Gợi ý tên Anki deck phân cấp (`::`) dựa trên form_type/ngôn ngữ để đồng bộ cây deck.
 * Hàm thuần — dễ kiểm thử.
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

/** Tạo category mới (chỉ cần name + form_type). */
export async function createCategory(params: {
  name: string
  formType: FormType
}): Promise<CreatedCategory> {
  const name = params.name.trim()
  const ref = await addDoc(collection(db, 'categories'), {
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
  /** true nếu đồng bộ AnkiConnect thất bại (vd Anki chưa mở). */
  ankiSyncFailed: boolean
}

/**
 * Tạo deck mới: lưu Firestore + đồng bộ Anki (ensure + unsuspend).
 * Nếu Anki không khả dụng → vẫn lưu app, trả `ankiSyncFailed = true`.
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
    await postDeckSync({ op: 'ensure', deckName: anki_deck_name })
    await postDeckSync({ op: 'unsuspend', deckName: anki_deck_name })
  } catch (e) {
    console.warn('AnkiConnect sync failed when creating deck:', e)
    ankiSyncFailed = true
  }

  return { id: ref.id, display_name, anki_deck_name, ankiSyncFailed }
}

async function postDeckSync(body: Record<string, unknown>): Promise<void> {
  const res = await fetch('/api/anki/decks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Deck sync failed: ${res.status}`)
}
