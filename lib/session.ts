import { FormType } from '@/types'

export interface SessionState {
  categoryId?: string
  language?: string
  deckId?: string
  cardTypeIds?: string[]
  topicIds?: string[]
  difficulty?: string
  tags?: string[]
}

type SessionKey = keyof SessionState

const SESSION_KEYS: SessionKey[] = [
  'categoryId', 'language', 'deckId', 'cardTypeIds', 'topicIds', 'difficulty', 'tags',
]

const getStorageKey = (formType: FormType) => `ankiflow_session_${formType}`

export const saveSession = (formType: FormType, data: SessionState): void => {
  if (typeof window === 'undefined') return
  try {
    const existing = loadSession(formType) ?? {}
    const updated: SessionState = { ...existing, ...data }
    localStorage.setItem(getStorageKey(formType), JSON.stringify(updated))
  } catch (e) {
    console.error('Error saving session', e)
  }
}

export const loadSession = (formType: FormType): SessionState | null => {
  if (typeof window === 'undefined') return null
  try {
    const item = localStorage.getItem(getStorageKey(formType))
    return item ? (JSON.parse(item) as SessionState) : null
  } catch (e) {
    console.error('Error loading session', e)
    return null
  }
}

export const clearSession = (formType: FormType): void => {
  if (typeof window === 'undefined') return
  localStorage.removeItem(getStorageKey(formType))
}

export const resetContentFields = (formType: FormType): SessionState | null => {
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
