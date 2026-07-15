import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearDraft,
  hasDraftContent,
  loadCreateUiState,
  loadDraft,
  saveCreateUiState,
  saveDraft,
} from '@/lib/create/draftCache'
import { FormType } from '@/types'

const DRAFT_KEY = `ankiflow_create_draft_${FormType.LANGUAGE}`
const UI_STATE_KEY = 'ankiflow_create_ui'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('create draft cache', () => {
  it('saveDraft → loadDraft の round-trip', () => {
    saveDraft(FormType.LANGUAGE, {
      values: { word: 'resilient', note: 'work context' },
      batchItems: ['', 'second'],
    })

    const draft = loadDraft(FormType.LANGUAGE)
    expect(draft?.values).toEqual({ word: 'resilient', note: 'work context' })
    expect(draft?.batchItems).toEqual(['', 'second'])
    expect(Number.isFinite(new Date(draft?.savedAt ?? '').getTime())).toBe(true)
  })

  it('24 時間を超えた draft は読み込み時に削除', () => {
    const savedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ values: { word: 'old' }, batchItems: [], savedAt }))

    expect(loadDraft(FormType.LANGUAGE)).toBeNull()
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('24 時間以内の draft は読み込む', () => {
    const savedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const expected = { values: { word: 'fresh' }, batchItems: ['one'], savedAt }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(expected))

    expect(loadDraft(FormType.LANGUAGE)).toEqual(expected)
  })

  it('壊れた JSON は例外を投げず null + 壊れた item を削除', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    localStorage.setItem(DRAFT_KEY, '{oops')

    expect(loadDraft(FormType.LANGUAGE)).toBeNull()
    // 残すと mount のたびに parse エラーが再発するため、その場で削除される
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('shape が不正な値は null + item を削除', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify('just a string'))

    expect(loadDraft(FormType.LANGUAGE)).toBeNull()
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('values に文字列以外が混入した draft は null + item を削除 (isStringRecord)', () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ values: { word: 1 }, batchItems: [], savedAt: new Date().toISOString() }),
    )

    expect(loadDraft(FormType.LANGUAGE)).toBeNull()
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('batchItems に文字列以外が混入した draft は null + item を削除', () => {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ values: {}, batchItems: [42], savedAt: new Date().toISOString() }),
    )

    expect(loadDraft(FormType.LANGUAGE)).toBeNull()
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('clearDraft は対象 key を削除', () => {
    saveDraft(FormType.LANGUAGE, { values: { word: 'test' }, batchItems: [] })

    clearDraft(FormType.LANGUAGE)

    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
  })
})

describe('hasDraftContent', () => {
  it('空または空白だけの内容は false', () => {
    expect(hasDraftContent({}, [''])).toBe(false)
    expect(hasDraftContent({ note: '   ' }, [''])).toBe(false)
  })

  it('values に内容があれば true', () => {
    expect(hasDraftContent({ word: 'x' }, [''])).toBe(true)
  })

  it('batchItems に内容があれば true', () => {
    expect(hasDraftContent({}, ['', 'word'])).toBe(true)
  })
})

describe('create UI state', () => {
  it('saveCreateUiState → loadCreateUiState の round-trip', () => {
    saveCreateUiState({ activeCode: FormType.IT, batchMode: true })

    expect(loadCreateUiState()).toEqual({ activeCode: FormType.IT, batchMode: true })
  })

  it('未保存の場合は null', () => {
    expect(loadCreateUiState()).toBeNull()
  })

  it('壊れた JSON または不正 shape は null + item を削除', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    localStorage.setItem(UI_STATE_KEY, '{oops')
    expect(loadCreateUiState()).toBeNull()
    expect(localStorage.getItem(UI_STATE_KEY)).toBeNull()

    localStorage.setItem(UI_STATE_KEY, JSON.stringify({ activeCode: 1, batchMode: 'yes' }))
    expect(loadCreateUiState()).toBeNull()
    expect(localStorage.getItem(UI_STATE_KEY)).toBeNull()
  })
})
