import { describe, expect, it } from 'vitest'
import {
  validateCardEntry,
  validateSelectedCardTypes,
  formatValidationMessage,
} from '@/lib/cardValidation'
import { FormType } from '@/types'
import type { CardValidationCardType } from '@/lib/cardValidation'
import type { Entry } from '@/types'

const DECK = 'Language::English::B1'
const WORD_MEANING_CARD: CardValidationCardType = {
  id: 'ct_word_to_meaning',
  name: 'Word → Meaning',
  code: 'word_to_meaning',
}
const CARD_TYPE_IDS = [WORD_MEANING_CARD.id]
const CARD_TYPES = [WORD_MEANING_CARD]

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

describe('validateCardEntry — template-aware', () => {
  it('Language は選択 template の両 side と deck が揃えば通過する', () => {
    expect(validateCardEntry(languageEntry(), CARD_TYPE_IDS, CARD_TYPES)).toEqual([])
  })

  it('template が使わない旧必須 field は要求しない', () => {
    const entry = languageEntry({
      ipa: '',
      word_type: '',
      example_sentence: '',
      example_translation: '',
    })
    expect(validateCardEntry(entry, CARD_TYPE_IDS, CARD_TYPES)).toEqual([])
  })

  it('選択 template の Front/Back が空なら side 固有 error を返す', () => {
    const errors = validateCardEntry(
      languageEntry({
        word: '',
        ipa: '',
        han_viet: '',
        meaning_vi: '',
        word_type: '',
        image_url: '',
        audio_url: '',
      }),
      CARD_TYPE_IDS,
      CARD_TYPES,
    )
    expect(errors.map(error => error.field)).toEqual([
      'card_type:ct_word_to_meaning:front',
      'card_type:ct_word_to_meaning:back',
    ])
  })

  it('flags empty deck', () => {
    const errors = validateCardEntry(languageEntry({ anki_deck: '' }), CARD_TYPE_IDS, CARD_TYPES)
    expect(errors.map(e => e.field)).toContain('anki_deck')
  })

  it('flags zero selected card types', () => {
    const errors = validateCardEntry(languageEntry(), [], CARD_TYPES)
    expect(errors.map(e => e.field)).toContain('card_types')
  })

  it('IT は Card Type code の fallback template で検証する', () => {
    const entry: Partial<Entry> = {
      form_type: FormType.IT,
      term: 'callback',
      definition: 'A function passed as an argument',
      anki_deck: 'IT::JS',
    }
    const cardType: CardValidationCardType = {
      id: 'ct-concept-definition',
      name: 'Concept → Definition',
      code: 'concept_to_def',
    }
    expect(validateCardEntry(entry, [cardType.id], [cardType])).toEqual([])
  })

  it('General は title/content を word/meaning source として扱う', () => {
    const entry: Partial<Entry> = {
      form_type: FormType.GENERAL,
      title: 'Photosynthesis',
      content: 'Plants convert light to energy',
      anki_deck: 'General',
    }
    const cardType: CardValidationCardType = {
      id: 'ct-general',
      name: 'Front → Back',
      code: 'front_to_back',
    }
    expect(validateCardEntry(entry, [cardType.id], [cardType])).toEqual([])
  })

  it('legacy alias だけの entry も renderer と同じ規則で通過する', () => {
    const entry = {
      form_type: FormType.IT,
      term: 'callback',
      definition_vi: 'Legacy definition',
      example_usage: 'Legacy example',
      anki_deck: 'IT::JS',
    } as Partial<Entry> & Record<string, unknown>
    const cardType: CardValidationCardType = {
      id: 'ct-legacy',
      name: 'Concept → Definition',
      template: {
        front: ['word'],
        back: ['meaning', 'example'],
      },
    }

    expect(validateCardEntry(entry, [cardType.id], [cardType])).toEqual([])
  })
})

describe('validateSelectedCardTypes — template-aware content', () => {
  const vietnameseChinese: CardValidationCardType = {
    id: 'ct-vi-zh',
    name: 'Vietnamese → Chinese',
    template: {
      front: ['meaning'],
      back: ['word', 'custom:phon_the'],
    },
  }

  it('custom:phon_the を含む Card Type は旧 Language 必須 field がなくても通過する', () => {
    const entry = {
      form_type: FormType.LANGUAGE,
      word: '吃饭',
      meaning_vi: 'ăn cơm',
      phon_the: '喫飯',
    } as Partial<Entry> & Record<string, unknown>

    expect(validateSelectedCardTypes(entry, [vietnameseChinese.id], [vietnameseChinese])).toEqual([])
  })

  it('template 内の optional block が空でも各 side に別の content があれば通過する', () => {
    const cardType: CardValidationCardType = {
      id: 'ct-default-shape',
      name: 'Default-shaped card',
      code: 'word_to_meaning',
    }

    expect(validateSelectedCardTypes(
      { word: '你好', meaning_vi: 'xin chào' },
      [cardType.id],
      [cardType],
    )).toEqual([])
  })

  it('custom field だけの side が空なら Card Type と side を特定して返す', () => {
    const cardType: CardValidationCardType = {
      id: 'ct-traditional-front',
      name: 'Traditional → Simplified',
      template: {
        front: ['custom:phon_the'],
        back: ['word'],
      },
    }

    expect(validateSelectedCardTypes(
      { word: '吃饭' },
      [cardType.id],
      [cardType],
    )).toEqual([{
      field: 'card_type:ct-traditional-front:front',
      label: 'Traditional → Simplified: Front has no content',
    }])
  })

  it('選択 ID が現在の Card Type 一覧にない場合は unavailable を返す', () => {
    expect(validateSelectedCardTypes(
      { word: '吃饭', meaning_vi: 'ăn cơm' },
      ['stale-card-type'],
      [vietnameseChinese],
    )).toEqual([{
      field: 'card_type:stale-card-type',
      label: 'Selected card type is unavailable',
    }])
  })

  it('Card Type 未選択は既存の selection error を返す', () => {
    expect(validateSelectedCardTypes({}, [], [vietnameseChinese])).toEqual([{
      field: 'card_types',
      label: 'Card type (select at least one)',
    }])
  })

  it('data URL の image/audio は export filename へ変換可能な content として扱う', () => {
    const cardType: CardValidationCardType = {
      id: 'ct-media',
      name: 'Image → Audio',
      template: { front: ['image'], back: ['audio'] },
    }

    expect(validateSelectedCardTypes({
      image_url: 'data:image/png;base64,QQ==',
      audio_url: 'data:audio/mp3;base64,QQ==',
    }, [cardType.id], [cardType])).toEqual([])
  })

  it('不正な media data URL は content として扱わない', () => {
    const cardType: CardValidationCardType = {
      id: 'ct-broken-media',
      name: 'Image → Audio',
      template: { front: ['image'], back: ['audio'] },
    }

    expect(validateSelectedCardTypes({
      image_url: 'data:image/png;base64,',
      audio_url: 'data:audio/mp3;base64,not base64',
    }, [cardType.id], [cardType]).map(error => error.field)).toEqual([
      'card_type:ct-broken-media:front',
      'card_type:ct-broken-media:back',
    ])
  })

  it('空白だけの builtin/custom field は空 side として扱う', () => {
    const cardType: CardValidationCardType = {
      id: 'ct-whitespace',
      name: 'Whitespace card',
      template: { front: ['word'], back: ['custom:phon_the'] },
    }

    expect(validateSelectedCardTypes(
      { word: '   ', phon_the: '\n' } as Partial<Entry>,
      [cardType.id],
      [cardType],
    ).map(error => error.field)).toEqual([
      'card_type:ct-whitespace:front',
      'card_type:ct-whitespace:back',
    ])
  })

  it('prototype key の legacy code でも安全な default template を使う', () => {
    const cardType: CardValidationCardType = {
      id: 'ct-constructor',
      name: 'Constructor',
      code: 'constructor',
    }

    expect(validateSelectedCardTypes(
      { word: 'safe', meaning_vi: 'fallback' },
      [cardType.id],
      [cardType],
    )).toEqual([])
  })

  it('History の既存 note media は entry に data URL がなくても保持可能として扱う', () => {
    const cardType: CardValidationCardType = {
      id: 'ct-existing-media',
      name: 'Audio → Image',
      template: { front: ['audio'], back: ['image'] },
    }

    expect(validateCardEntry(
      { anki_deck: 'Existing', anki_note_ids: [1] },
      [cardType.id],
      [cardType],
      { assumeExistingMedia: true },
    )).toEqual([])
  })
})

describe('formatValidationMessage', () => {
  it('labels を一つの英語メッセージにまとめる', () => {
    const msg = formatValidationMessage([
      { field: 'meaning', label: 'Meaning' },
      { field: 'anki_deck', label: 'Anki Deck' },
    ])
    expect(msg).toContain('Card cannot be saved: Meaning')
    expect(msg).toContain('Anki Deck')
    expect(msg).not.toContain('required fields')
  })
})
