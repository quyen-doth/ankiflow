import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearSession,
  loadSession,
  resetContentFields,
  saveSession,
} from '@/lib/session'
import { FormType } from '@/types'

describe('lib/session', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saveSession → loadSession の round-trip (各 FormType ごと)', () => {
    saveSession(FormType.LANGUAGE, { language: 'english', deckId: 'd1', tags: ['n5'] })
    saveSession(FormType.IT, { topicIds: ['t1'], topicNames: ['Backend'], difficulty: 'medium' })

    expect(loadSession(FormType.LANGUAGE)).toEqual({
      language: 'english',
      deckId: 'd1',
      tags: ['n5'],
    })
    expect(loadSession(FormType.IT)).toEqual({
      topicIds: ['t1'],
      topicNames: ['Backend'],
      difficulty: 'medium',
    })
    // Sessions của các form_type độc lập với nhau
    expect(loadSession(FormType.GENERAL)).toBeNull()
  })

  it('saveSession は既存の session と merge し、全体を上書きしない', () => {
    saveSession(FormType.LANGUAGE, { language: 'english' })
    saveSession(FormType.LANGUAGE, { deckId: 'd2' })

    expect(loadSession(FormType.LANGUAGE)).toEqual({ language: 'english', deckId: 'd2' })
  })

  it('データがない場合 loadSession は null を返す', () => {
    expect(loadSession(FormType.LANGUAGE)).toBeNull()
  })

  it('localStorage の JSON が壊れている場合 loadSession は null を返す', () => {
    localStorage.setItem(`ankiflow_session_${FormType.LANGUAGE}`, '{not-json')
    expect(loadSession(FormType.LANGUAGE)).toBeNull()
  })

  it('clearSession はその form_type の session を正しく削除する', () => {
    saveSession(FormType.LANGUAGE, { language: 'english' })
    saveSession(FormType.IT, { difficulty: 'easy' })

    clearSession(FormType.LANGUAGE)

    expect(loadSession(FormType.LANGUAGE)).toBeNull()
    expect(loadSession(FormType.IT)).toEqual({ difficulty: 'easy' })
  })

  it('resetContentFields は宣言済みの config fields を保持する', () => {
    saveSession(FormType.LANGUAGE, {
      categoryId: 'c1',
      language: 'english',
      deckId: 'd1',
      cardTypeIds: ['ct1'],
      tags: ['hsk1'],
    })

    const preserved = resetContentFields(FormType.LANGUAGE)

    expect(preserved).toEqual({
      categoryId: 'c1',
      language: 'english',
      deckId: 'd1',
      cardTypeIds: ['ct1'],
      tags: ['hsk1'],
    })
    expect(loadSession(FormType.LANGUAGE)).toEqual(preserved)
  })

  it('resetContentFields は IT Topic の ID と名前を一緒に保持する', () => {
    saveSession(FormType.IT, {
      topicIds: ['t1'],
      topicNames: ['Backend'],
      difficulty: 'advanced',
    })

    expect(resetContentFields(FormType.IT)).toEqual({
      topicIds: ['t1'],
      topicNames: ['Backend'],
      difficulty: 'advanced',
    })
  })

  it('session がない場合 resetContentFields は null を返す', () => {
    expect(resetContentFields(FormType.LANGUAGE)).toBeNull()
  })
})
