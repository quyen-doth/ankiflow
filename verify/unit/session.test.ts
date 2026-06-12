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

  it('saveSession → loadSession round-trip theo từng FormType', () => {
    saveSession(FormType.LANGUAGE, { language: 'english', deckId: 'd1', tags: ['n5'] })
    saveSession(FormType.IT, { topicIds: ['t1'], difficulty: 'medium' })

    expect(loadSession(FormType.LANGUAGE)).toEqual({
      language: 'english',
      deckId: 'd1',
      tags: ['n5'],
    })
    expect(loadSession(FormType.IT)).toEqual({ topicIds: ['t1'], difficulty: 'medium' })
    // Sessions của các form_type độc lập với nhau
    expect(loadSession(FormType.GENERAL)).toBeNull()
  })

  it('saveSession merge với session đã có thay vì ghi đè toàn bộ', () => {
    saveSession(FormType.LANGUAGE, { language: 'english' })
    saveSession(FormType.LANGUAGE, { deckId: 'd2' })

    expect(loadSession(FormType.LANGUAGE)).toEqual({ language: 'english', deckId: 'd2' })
  })

  it('loadSession trả null khi chưa có dữ liệu', () => {
    expect(loadSession(FormType.LANGUAGE)).toBeNull()
  })

  it('loadSession trả null khi JSON trong localStorage bị hỏng', () => {
    localStorage.setItem(`ankiflow_session_${FormType.LANGUAGE}`, '{not-json')
    expect(loadSession(FormType.LANGUAGE)).toBeNull()
  })

  it('clearSession xóa đúng session của form_type đó', () => {
    saveSession(FormType.LANGUAGE, { language: 'english' })
    saveSession(FormType.IT, { difficulty: 'easy' })

    clearSession(FormType.LANGUAGE)

    expect(loadSession(FormType.LANGUAGE)).toBeNull()
    expect(loadSession(FormType.IT)).toEqual({ difficulty: 'easy' })
  })

  it('resetContentFields giữ nguyên các config fields đã khai báo', () => {
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

  it('resetContentFields trả null khi chưa có session', () => {
    expect(resetContentFields(FormType.LANGUAGE)).toBeNull()
  })
})
