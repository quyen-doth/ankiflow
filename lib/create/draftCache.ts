import { FormType } from '@/types'

// Create ページで入力中 (未生成) の内容を localStorage にキャッシュする。
// config (deck/tags など) は lib/session.ts が担当し、ここでは content のみを扱う。
export interface CreateDraft {
  values: Record<string, string>
  batchItems: string[]
  savedAt: string
}

export interface CreateUiState {
  activeCode: string
  batchMode: boolean
}

// 未生成の下書きは generate 結果より長く保持し、翌日戻るケースをカバーする。
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000
const draftKey = (formType: FormType | string) => `ankiflow_create_draft_${formType}`
const UI_STATE_KEY = 'ankiflow_create_ui'

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.values(value).every(item => typeof item === 'string')
}

function isCreateDraft(value: unknown): value is CreateDraft {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const candidate = value as Record<string, unknown>
  return isStringRecord(candidate.values)
    && Array.isArray(candidate.batchItems)
    && candidate.batchItems.every(item => typeof item === 'string')
    && typeof candidate.savedAt === 'string'
    && Number.isFinite(new Date(candidate.savedAt).getTime())
}

export function saveDraft(
  formType: FormType | string,
  draft: { values: Record<string, string>; batchItems: string[] },
): void {
  if (typeof window === 'undefined') return
  try {
    const value: CreateDraft = { ...draft, savedAt: new Date().toISOString() }
    localStorage.setItem(draftKey(formType), JSON.stringify(value))
  } catch (error) {
    console.error('Error saving create draft', error)
  }
}

export function loadDraft(formType: FormType | string): CreateDraft | null {
  if (typeof window === 'undefined') return null
  const key = draftKey(formType)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!isCreateDraft(value)) {
      // 壊れた/形式不正の item を残すと mount のたびに parse エラーが再発し、
      // savedAt を読めないため TTL cleanup も効かない → その場で削除する。
      localStorage.removeItem(key)
      return null
    }
    if (Date.now() - new Date(value.savedAt).getTime() > DRAFT_TTL_MS) {
      localStorage.removeItem(key)
      return null
    }
    return value
  } catch (error) {
    console.error('Error loading create draft', error)
    try {
      localStorage.removeItem(key)
    } catch {
      /* storage 自体が使えない場合は無視 */
    }
    return null
  }
}

export function clearDraft(formType: FormType | string): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(draftKey(formType))
}

export function hasDraftContent(values: Record<string, string>, batchItems: string[]): boolean {
  return Object.values(values).some(value => value.trim().length > 0)
    || batchItems.some(item => item.trim().length > 0)
}

export function saveCreateUiState(state: CreateUiState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(UI_STATE_KEY, JSON.stringify(state))
  } catch (error) {
    console.error('Error saving create UI state', error)
  }
}

export function loadCreateUiState(): CreateUiState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(UI_STATE_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      localStorage.removeItem(UI_STATE_KEY)
      return null
    }
    const candidate = value as Record<string, unknown>
    if (typeof candidate.activeCode !== 'string' || typeof candidate.batchMode !== 'boolean') {
      localStorage.removeItem(UI_STATE_KEY)
      return null
    }
    return { activeCode: candidate.activeCode, batchMode: candidate.batchMode }
  } catch (error) {
    console.error('Error loading create UI state', error)
    try {
      localStorage.removeItem(UI_STATE_KEY)
    } catch {
      /* storage 自体が使えない場合は無視 */
    }
    return null
  }
}
