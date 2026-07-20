import { describe, expect, it } from 'vitest'
import { validateCardEntry, formatValidationMessage } from '@/lib/cardValidation'
import { FormType } from '@/types'
import type { Entry } from '@/types'

const DECK = 'Language::English::B1'
const CARD_TYPES = ['ct_word_to_meaning']

function languageEntry(overrides: Partial<Entry> = {}): Partial<Entry> {
  return {
    form_type: FormType.LANGUAGE,
    word: 'hello',
    ipa: 'həˈloʊ',
    meaning_vi: 'こんにちは',
    word_type: 'interjection',
    example_sentence: 'Hello, how are you?',
    example_translation: 'こんにちは、お元気ですか？',
    anki_deck: DECK,
    ...overrides,
  }
}

describe('validateCardEntry — LANGUAGE', () => {
  it('passes when all core fields, deck and ≥1 card type present', () => {
    expect(validateCardEntry(languageEntry(), CARD_TYPES)).toEqual([])
  })

  it('flags missing meaning', () => {
    const errors = validateCardEntry(languageEntry({ meaning_vi: '' }), CARD_TYPES)
    expect(errors.map(e => e.field)).toContain('meaning')
  })

  it('flags missing reading (no hiragana/pinyin/ipa)', () => {
    const errors = validateCardEntry(languageEntry({ ipa: '' }), CARD_TYPES)
    expect(errors.map(e => e.field)).toContain('reading')
  })

  it('accepts hiragana or pinyin as reading', () => {
    expect(validateCardEntry(languageEntry({ ipa: '', hiragana: 'こんにちは' }), CARD_TYPES)).toEqual([])
    expect(validateCardEntry(languageEntry({ ipa: '', pinyin: 'nǐ hǎo' }), CARD_TYPES)).toEqual([])
  })

  it('flags missing word_type, example and translation', () => {
    const errors = validateCardEntry(
      languageEntry({ word_type: '', example_sentence: '', example_translation: '' }),
      CARD_TYPES,
    )
    const fields = errors.map(e => e.field)
    expect(fields).toContain('word_type')
    expect(fields).toContain('example')
    expect(fields).toContain('translation')
  })
})

describe('validateCardEntry — deck & card type guards', () => {
  it('flags empty deck', () => {
    const errors = validateCardEntry(languageEntry({ anki_deck: '' }), CARD_TYPES)
    expect(errors.map(e => e.field)).toContain('anki_deck')
  })

  it('flags zero selected card types', () => {
    const errors = validateCardEntry(languageEntry(), [])
    expect(errors.map(e => e.field)).toContain('card_types')
  })
})

describe('validateCardEntry — IT', () => {
  it('passes with term, meaning (definition) and example_usage', () => {
    const entry: Partial<Entry> = {
      form_type: FormType.IT,
      term: 'callback',
      definition: 'A function passed as an argument',
      anki_deck: 'IT::JS',
      ...({ example_usage: 'setTimeout(cb, 0)' } as Partial<Entry>),
    }
    expect(validateCardEntry(entry, CARD_TYPES)).toEqual([])
  })

  it('does not require reading/word_type/translation for IT', () => {
    const entry: Partial<Entry> = {
      form_type: FormType.IT,
      term: 'callback',
      definition: 'A function passed as an argument',
      example_sentence: 'use it',
      anki_deck: 'IT::JS',
    }
    expect(validateCardEntry(entry, CARD_TYPES)).toEqual([])
  })
})

describe('validateCardEntry — GENERAL', () => {
  it('requires only title and meaning', () => {
    const entry: Partial<Entry> = {
      form_type: FormType.GENERAL,
      title: 'Photosynthesis',
      content: 'Plants convert light to energy',
      anki_deck: 'General',
    }
    expect(validateCardEntry(entry, CARD_TYPES)).toEqual([])
  })

  it('flags missing meaning for GENERAL', () => {
    const entry: Partial<Entry> = {
      form_type: FormType.GENERAL,
      title: 'Photosynthesis',
      anki_deck: 'General',
    }
    expect(validateCardEntry(entry, CARD_TYPES).map(e => e.field)).toContain('meaning')
  })
})

describe('formatValidationMessage', () => {
  it('labels を一つの英語メッセージにまとめる', () => {
    const msg = formatValidationMessage([
      { field: 'meaning', label: 'Meaning' },
      { field: 'anki_deck', label: 'Anki Deck' },
    ])
    expect(msg).toContain('Missing: Meaning')
    expect(msg).toContain('Anki Deck')
    expect(msg).toContain('Complete all required fields before creating.')
  })
})
