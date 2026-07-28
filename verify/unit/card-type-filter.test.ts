import { describe, expect, it } from 'vitest'
import {
  filterCardTypesByScope,
  type CardTypeScopeLike,
} from '@/lib/cardTypeFilter'

interface TestCardType extends CardTypeScopeLike {
  id: string;
}

const cardTypes: TestCardType[] = [
  {
    id: 'global',
    language: null,
    output_language: null,
    is_active: true,
    is_default: false,
    sort_order: 30,
  },
  {
    id: 'en-ja',
    language: 'en',
    output_language: 'ja',
    is_active: true,
    is_default: false,
    sort_order: 20,
  },
  {
    id: 'en-zh',
    language: 'en',
    output_language: 'zh',
    is_active: true,
    is_default: false,
    sort_order: 10,
  },
  {
    id: 'default',
    language: 'ko',
    output_language: 'fr',
    is_active: true,
    is_default: true,
    sort_order: 5,
  },
  {
    id: 'inactive-default',
    language: 'ko',
    output_language: 'fr',
    is_active: false,
    is_default: true,
    sort_order: 1,
  },
]

describe('filterCardTypesByScope', () => {
  it('null scope はすべての言語に一致する', () => {
    expect(filterCardTypesByScope(cardTypes, {
      studyLanguage: 'en',
      outputLanguage: 'ja',
    }).map(cardType => cardType.id)).toEqual(['en-ja', 'global'])
  })

  it('学習言語と出力言語の両方が一致する Card Type を返す', () => {
    expect(filterCardTypesByScope(cardTypes.slice(1), {
      studyLanguage: 'en',
      outputLanguage: 'zh-TW',
    }).map(cardType => cardType.id)).toEqual(['en-zh'])
  })

  it('学習言語だけ一致して出力言語が違う Card Type を除外する', () => {
    expect(filterCardTypesByScope(cardTypes.slice(1, 3), {
      studyLanguage: 'en',
      outputLanguage: 'ko',
    })).toEqual([])
  })

  it('一致対象がなければ有効なデフォルトだけを返す', () => {
    expect(filterCardTypesByScope(cardTypes.slice(1), {
      studyLanguage: 'de',
      outputLanguage: 'it',
    }).map(cardType => cardType.id)).toEqual(['default'])
  })

  it('デフォルトがなければ空配列を返す', () => {
    expect(filterCardTypesByScope(cardTypes.slice(1, 3), {
      studyLanguage: 'de',
      outputLanguage: 'it',
    })).toEqual([])
  })

  it('フォールバックでも無効な Card Type を除外する', () => {
    expect(filterCardTypesByScope([cardTypes[4]], {
      studyLanguage: 'de',
      outputLanguage: 'it',
    })).toEqual([])
  })

  it('sort_order の昇順で返し、入力配列は変更しない', () => {
    const input = [cardTypes[0], cardTypes[2], cardTypes[1]]
    const originalOrder = input.map(cardType => cardType.id)

    expect(filterCardTypesByScope(input, {
      studyLanguage: 'en',
      outputLanguage: null,
    }).map(cardType => cardType.id)).toEqual(['en-zh', 'en-ja', 'global'])
    expect(input.map(cardType => cardType.id)).toEqual(originalOrder)
  })

  it('primary tag は地域 variant に一致するが、具体 tag は別 variant に一致しない', () => {
    const regional: TestCardType[] = [
      { id: 'generic', language: 'zh', output_language: null },
      { id: 'taiwan', language: 'zh-TW', output_language: null },
    ]

    expect(filterCardTypesByScope(regional, {
      studyLanguage: 'zh-TW',
    }).map(cardType => cardType.id)).toEqual(['generic', 'taiwan'])
    expect(filterCardTypesByScope(regional, {
      studyLanguage: 'zh-CN',
    }).map(cardType => cardType.id)).toEqual(['generic'])
  })

  it('既存データの未定義 output scope はすべての出力言語に一致する', () => {
    expect(filterCardTypesByScope([
      {
        id: 'legacy',
        language: 'en',
        is_active: true,
      },
    ], {
      studyLanguage: 'en',
      outputLanguage: 'ja',
    }).map(cardType => cardType.id)).toEqual(['legacy'])
  })
})
