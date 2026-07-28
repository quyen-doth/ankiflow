import { describe, expect, it } from 'vitest'
import { renderCardTypeName } from '@/lib/cardTypeName'
import type { StudyLanguage } from '@/types'

const languages: StudyLanguage[] = [
  { code: 'en', display_name: 'English', enabled: true, sort_order: 0 },
  { code: 'ja', display_name: '日本語（カスタム）', enabled: true, sort_order: 1 },
  { code: 'zh-TW', display_name: '繁體中文', enabled: true, sort_order: 2 },
]

describe('renderCardTypeName', () => {
  it('実行時コンテキストで両方のプレースホルダーを解決する', () => {
    expect(renderCardTypeName(
      '{study_language} → {output_language}',
      {
        studyLanguage: 'en',
        outputLanguage: 'ja',
        languages,
      },
    )).toBe('English → 日本語（カスタム）')
  })

  it('実行時コンテキスト、Card Type の scope、未解決トークンの順に優先する', () => {
    expect(renderCardTypeName(
      '{study_language} → {output_language}',
      {
        studyLanguage: 'zh-TW',
        cardType: {
          language: 'en',
        },
        languages,
      },
    )).toBe('繁體中文 → {output_language}')
  })

  it('Card Type 自身の scope をフォールバックとして使う', () => {
    expect(renderCardTypeName(
      '{study_language} → {output_language}',
      {
        cardType: {
          language: 'en',
          output_language: 'ja',
        },
        languages,
      },
    )).toBe('English → 日本語（カスタム）')
  })

  it('設定済みのカスタム表示名を優先する', () => {
    expect(renderCardTypeName(
      '{study_language} output',
      {
        studyLanguage: 'ja',
        languages,
      },
    )).toBe('日本語（カスタム） output')
  })

  it('設定にない言語は推測した表示名を使う', () => {
    expect(renderCardTypeName(
      '{study_language} → {output_language}',
      {
        studyLanguage: 'ko',
        outputLanguage: 'en-US',
        languages,
      },
    )).toBe('Korean → American English')
  })

  it('プレースホルダーを含まない名前は変更しない', () => {
    expect(renderCardTypeName(
      'Definition card',
      {
        studyLanguage: 'en',
        outputLanguage: 'ja',
        languages,
      },
    )).toBe('Definition card')
  })

  it('同じプレースホルダーが複数ある場合もすべて解決する', () => {
    expect(renderCardTypeName(
      '{study_language} / {study_language}',
      {
        studyLanguage: 'en',
        languages,
      },
    )).toBe('English / English')
  })
})
