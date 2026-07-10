import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STUDY_LANGUAGES,
  addOrEnableStudyLanguage,
  canonicalizeLanguageCode,
  languageDisplayName,
  normalizeStudyLanguages,
  resolveStudyLanguage,
  validateStudyLanguages,
} from '@/lib/studyLanguages'
import type { StudyLanguage } from '@/types'

describe('studyLanguages — BCP 47 normalization', () => {
  it('canonicalizes case and underscore variants', () => {
    expect(canonicalizeLanguageCode(' pt_br ')).toBe('pt-BR')
    expect(canonicalizeLanguageCode('ZH-hant')).toBe('zh-Hant')
    expect(canonicalizeLanguageCode('not a language')).toBeNull()
  })

  it('uses legacy defaults when the settings field is missing', () => {
    expect(normalizeStudyLanguages(undefined)).toEqual(DEFAULT_STUDY_LANGUAGES)
  })

  it('sorts, canonicalizes, deduplicates, and fills a missing display name', () => {
    const result = normalizeStudyLanguages([
      { code: 'fr', display_name: '', enabled: true, sort_order: 3 },
      { code: 'pt_br', display_name: 'Português', enabled: false, sort_order: 1 },
      { code: 'FR', display_name: 'Duplicate', enabled: true, sort_order: 0 },
      { code: 'invalid value', display_name: 'Invalid', enabled: true, sort_order: 2 },
    ])

    expect(result).toEqual([
      { code: 'pt-BR', display_name: 'Português', enabled: false, sort_order: 0 },
      { code: 'fr', display_name: 'French', enabled: true, sort_order: 1 },
    ])
  })
})
describe('studyLanguages — validation and updates', () => {
  const languages: StudyLanguage[] = [
    { code: 'en-US', display_name: 'American English', enabled: true, sort_order: 0 },
    { code: 'en-GB', display_name: 'British English', enabled: true, sort_order: 1 },
    { code: 'fr', display_name: 'French', enabled: false, sort_order: 2 },
  ]

  it('requires unique codes, names, and at least one enabled language', () => {
    expect(validateStudyLanguages([
      { code: 'fr', display_name: '', enabled: false, sort_order: 0 },
      { code: 'FR', display_name: 'French', enabled: false, sort_order: 1 },
    ])).toEqual(expect.arrayContaining([
      'Add a display name for "fr".',
      'Language code "fr" is duplicated.',
      'Keep at least one study language enabled.',
    ]))
  })

  it('re-enables an existing code without overwriting its custom name', () => {
    const result = addOrEnableStudyLanguage(languages, { code: 'FR', display_name: 'Français' })
    expect(result[2]).toEqual({ code: 'fr', display_name: 'French', enabled: true, sort_order: 2 })
  })

  it('adds and canonicalizes a new open-catalog language', () => {
    const result = addOrEnableStudyLanguage(languages, { code: 'pt_br', display_name: 'Português' })
    expect(result.at(-1)).toEqual({
      code: 'pt-BR',
      display_name: 'Português',
      enabled: true,
      sort_order: 3,
    })
  })

  it('matches exact tags first and resolves ambiguous base tags deterministically', () => {
    expect(resolveStudyLanguage('en-GB', languages)?.display_name).toBe('British English')
    expect(resolveStudyLanguage('en', languages, 'en-GB')?.display_name).toBe('British English')
    expect(resolveStudyLanguage('en', languages)?.display_name).toBe('American English')
    expect(resolveStudyLanguage('fr', languages)).toBeNull()
  })

  it('uses configured labels and falls back to Intl.DisplayNames', () => {
    expect(languageDisplayName('en-US', languages)).toBe('American English')
    expect(languageDisplayName('ko', languages)).toBe('Korean')
  })
})
