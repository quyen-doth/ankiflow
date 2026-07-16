import { FormType } from '@/types'

export interface SessionState {
  categoryId?: string
  language?: string
  /** Ephemeral display name for AI prompts; intentionally not persisted in SESSION_KEYS. */
  languageName?: string
  /** AI 出力言語。SESSION_KEYS には含めず、ユーザー設定から毎回注入する。 */
  outputLanguage?: string
  /** AI 出力言語の表示名。prompt 用の一時データとしてのみ使用する。 */
  outputLanguageName?: string
  deckId?: string
  cardTypeIds?: string[]
  topicIds?: string[]
  /** AI prompt 用の Topic 表示名。TopicSelector が ID から毎回再同期する。 */
  topicNames?: string[]
  difficulty?: string
  tags?: string[]
}

type SessionKey = keyof SessionState

const SESSION_KEYS: SessionKey[] = [
  'categoryId', 'language', 'deckId', 'cardTypeIds', 'topicIds', 'topicNames', 'difficulty', 'tags',
]

const getStorageKey = (formType: FormType | string) => `ankiflow_session_${formType}`

export const saveSession = (formType: FormType | string, data: SessionState): void => {
  if (typeof window === 'undefined') return
  try {
    const existing = loadSession(formType) ?? {}
    const updated: SessionState = { ...existing, ...data }
    localStorage.setItem(getStorageKey(formType), JSON.stringify(updated))
  } catch (e) {
    console.error('Error saving session', e)
  }
}

export const loadSession = (formType: FormType | string): SessionState | null => {
  if (typeof window === 'undefined') return null
  try {
    const item = localStorage.getItem(getStorageKey(formType))
    return item ? (JSON.parse(item) as SessionState) : null
  } catch (e) {
    console.error('Error loading session', e)
    return null
  }
}

export const clearSession = (formType: FormType | string): void => {
  if (typeof window === 'undefined') return
  localStorage.removeItem(getStorageKey(formType))
}

export const resetContentFields = (formType: FormType | string): SessionState | null => {
  if (typeof window === 'undefined') return null
  const current = loadSession(formType)
  if (!current) return null

  const preserved: SessionState = {}
  for (const key of SESSION_KEYS) {
    const value = current[key]
    if (value !== undefined) {
      (preserved as Record<string, unknown>)[key] = value
    }
  }

  localStorage.setItem(getStorageKey(formType), JSON.stringify(preserved))
  return preserved
}
