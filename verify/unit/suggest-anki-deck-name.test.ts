import { describe, expect, it } from 'vitest'
import { suggestAnkiDeckName } from '@/lib/create/createDeckCategory'
import { FormType, LanguageType } from '@/types'

describe('suggestAnkiDeckName', () => {
  it('Language + 言語 → 言語による階層プレフィックス', () => {
    expect(suggestAnkiDeckName('TOEIC 800', FormType.LANGUAGE, LanguageType.ENGLISH)).toBe('English::TOEIC 800')
    expect(suggestAnkiDeckName('HSK 5', FormType.LANGUAGE, LanguageType.CHINESE)).toBe('Chinese::HSK 5')
    expect(suggestAnkiDeckName('N2', FormType.LANGUAGE, LanguageType.JAPANESE)).toBe('Japanese::N2')
  })

  it('ユーザーが設定した表示名をプレフィックスに使用', () => {
    expect(suggestAnkiDeckName('A1', FormType.LANGUAGE, 'fr', 'Français')).toBe('Français::A1')
  })

  it('Language で言語がない → 名前をそのまま維持', () => {
    expect(suggestAnkiDeckName('Misc', FormType.LANGUAGE, null)).toBe('Misc')
  })

  it('IT → IT プレフィックス', () => {
    expect(suggestAnkiDeckName('Docker', FormType.IT)).toBe('IT::Docker')
  })

  it('General → General プレフィックス', () => {
    expect(suggestAnkiDeckName('Trivia', FormType.GENERAL)).toBe('General::Trivia')
  })

  it('カスタム/不明な content type → 名前をそのまま維持', () => {
    expect(suggestAnkiDeckName('Custom', 'form_custom')).toBe('Custom')
  })

  it('余分な空白をトリム、空 → 空文字列', () => {
    expect(suggestAnkiDeckName('  Spaces  ', FormType.IT)).toBe('IT::Spaces')
    expect(suggestAnkiDeckName('   ', FormType.LANGUAGE, LanguageType.ENGLISH)).toBe('')
  })
})
