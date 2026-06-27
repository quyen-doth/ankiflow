import { describe, expect, it } from 'vitest'
import { suggestAnkiDeckName } from '@/lib/create/createDeckCategory'
import { FormType, LanguageType } from '@/types'

describe('suggestAnkiDeckName', () => {
  it('Language + ngôn ngữ → tiền tố phân cấp theo ngôn ngữ', () => {
    expect(suggestAnkiDeckName('TOEIC 800', FormType.LANGUAGE, LanguageType.ENGLISH)).toBe('English::TOEIC 800')
    expect(suggestAnkiDeckName('HSK 5', FormType.LANGUAGE, LanguageType.CHINESE)).toBe('Chinese::HSK 5')
    expect(suggestAnkiDeckName('N2', FormType.LANGUAGE, LanguageType.JAPANESE)).toBe('Japanese::N2')
  })

  it('Language không có ngôn ngữ → giữ nguyên tên', () => {
    expect(suggestAnkiDeckName('Misc', FormType.LANGUAGE, null)).toBe('Misc')
  })

  it('IT → tiền tố IT', () => {
    expect(suggestAnkiDeckName('Docker', FormType.IT)).toBe('IT::Docker')
  })

  it('General → tiền tố General', () => {
    expect(suggestAnkiDeckName('Trivia', FormType.GENERAL)).toBe('General::Trivia')
  })

  it('content type tùy chỉnh / không xác định → giữ nguyên tên', () => {
    expect(suggestAnkiDeckName('Custom', 'form_custom')).toBe('Custom')
  })

  it('cắt khoảng trắng thừa, rỗng → chuỗi rỗng', () => {
    expect(suggestAnkiDeckName('  Spaces  ', FormType.IT)).toBe('IT::Spaces')
    expect(suggestAnkiDeckName('   ', FormType.LANGUAGE, LanguageType.ENGLISH)).toBe('')
  })
})
