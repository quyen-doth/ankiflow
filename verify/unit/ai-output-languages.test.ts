import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AI_OUTPUT_LANGUAGE_CODE,
  DEFAULT_AI_OUTPUT_LANGUAGES,
  addOrEnableAiOutputLanguage,
  normalizeAiOutputLanguagePreferences,
  validateAiOutputLanguagePreferences,
} from '@/lib/aiOutputLanguages'
import type { AiOutputLanguage } from '@/types'

describe('aiOutputLanguages — legacy normalization', () => {
  it('新しいリストがない場合は legacy default から 1 件を導出する', () => {
    expect(normalizeAiOutputLanguagePreferences(undefined, 'ja')).toEqual({
      languages: [{
        code: 'ja',
        display_name: 'Japanese',
        enabled: true,
        sort_order: 0,
      }],
      defaultLanguage: 'ja',
    })
  })

  it('両 field がない場合は Vietnamese default を使用する', () => {
    expect(normalizeAiOutputLanguagePreferences(undefined, undefined)).toEqual({
      languages: DEFAULT_AI_OUTPUT_LANGUAGES,
      defaultLanguage: DEFAULT_AI_OUTPUT_LANGUAGE_CODE,
    })
  })

  it('正規化・重複排除・sort を行い、保存 default が無効なら先頭の enabled へ fallback する', () => {
    const result = normalizeAiOutputLanguagePreferences([
      { code: 'ja', display_name: '', enabled: true, sort_order: 3 },
      { code: 'pt_br', display_name: 'Português', enabled: true, sort_order: 1 },
      { code: 'JA', display_name: 'Duplicate', enabled: true, sort_order: 0 },
      { code: 'vi', display_name: 'Tiếng Việt', enabled: false, sort_order: 2 },
      { code: 'invalid value', enabled: true, sort_order: 4 },
    ], 'vi')

    expect(result).toEqual({
      languages: [
        { code: 'pt-BR', display_name: 'Português', enabled: true, sort_order: 0 },
        { code: 'vi', display_name: 'Tiếng Việt', enabled: false, sort_order: 1 },
        { code: 'ja', display_name: 'Japanese', enabled: true, sort_order: 2 },
      ],
      defaultLanguage: 'pt-BR',
    })
  })

  it('corrupt all-disabled list を Create が使える状態へ回復する', () => {
    expect(normalizeAiOutputLanguagePreferences([
      { code: 'ja', display_name: 'Japanese', enabled: false, sort_order: 0 },
      { code: 'vi', display_name: 'Vietnamese', enabled: false, sort_order: 1 },
    ], 'vi')).toEqual({
      languages: [
        { code: 'ja', display_name: 'Japanese', enabled: true, sort_order: 0 },
        { code: 'vi', display_name: 'Vietnamese', enabled: false, sort_order: 1 },
      ],
      defaultLanguage: 'ja',
    })
  })
})

describe('aiOutputLanguages — validation and updates', () => {
  const languages: AiOutputLanguage[] = [
    { code: 'vi', display_name: 'Vietnamese', enabled: true, sort_order: 0 },
    { code: 'ja', display_name: 'Japanese', enabled: false, sort_order: 1 },
  ]

  it('default は enabled list 内の exact canonical code でなければならない', () => {
    expect(validateAiOutputLanguagePreferences(languages, 'ja')).toContain(
      'Default AI output language must be enabled in your AI output languages.',
    )
    expect(validateAiOutputLanguagePreferences(languages, 'vi')).toEqual([])
  })

  it('重複 code、空 display name、全 disable を拒否する', () => {
    expect(validateAiOutputLanguagePreferences([
      { code: 'ja', display_name: '', enabled: false, sort_order: 0 },
      { code: 'JA', display_name: 'Japanese', enabled: false, sort_order: 1 },
    ], 'ja')).toEqual(expect.arrayContaining([
      'Add a display name for AI output language "ja".',
      'AI output language code "ja" is duplicated.',
      'Keep at least one AI output language enabled.',
      'Default AI output language must be enabled in your AI output languages.',
    ]))
  })

  it('既存言語を custom name を失わず再有効化する', () => {
    expect(addOrEnableAiOutputLanguage(
      languages,
      { code: 'JA', display_name: '日本語' },
    )[1]).toEqual({
      code: 'ja',
      display_name: 'Japanese',
      enabled: true,
      sort_order: 1,
    })
  })

  it('新しい BCP 47 code を canonicalize して追加する', () => {
    expect(addOrEnableAiOutputLanguage(
      languages,
      { code: 'pt_br', display_name: 'Português' },
    ).at(-1)).toEqual({
      code: 'pt-BR',
      display_name: 'Português',
      enabled: true,
      sort_order: 2,
    })
  })
})
