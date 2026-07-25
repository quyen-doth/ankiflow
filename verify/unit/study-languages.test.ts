import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STUDY_LANGUAGES,
  addOrEnableStudyLanguage,
  canonicalizeLanguageCode,
  languageDisplayName,
  matchesLanguageScope,
  mergeStudyLanguageEdits,
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

  it('language scope は generic tag だけを regional variant へ広げる', () => {
    expect(matchesLanguageScope(null, 'zh-TW')).toBe(true)
    expect(matchesLanguageScope('zh', 'zh-TW')).toBe(true)
    expect(matchesLanguageScope('ZH', 'zh-Hant')).toBe(true)
    expect(matchesLanguageScope('zh-TW', 'zh-TW')).toBe(true)
    expect(matchesLanguageScope('zh-TW', 'zh-CN')).toBe(false)
    expect(matchesLanguageScope('zh-TW', 'zh')).toBe(false)
    expect(matchesLanguageScope('ja', 'zh-TW')).toBe(false)
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

describe('studyLanguages — merge stale Settings drafts', () => {
  const baseline = ['en', 'fr']
  const draft: StudyLanguage[] = [
    { code: 'fr', display_name: 'Français', enabled: true, sort_order: 0 },
    { code: 'en', display_name: 'English', enabled: false, sort_order: 1 },
  ]

  it('preserves languages added elsewhere after the baseline was captured', () => {
    const server: StudyLanguage[] = [
      { code: 'en', display_name: 'English', enabled: true, sort_order: 0 },
      { code: 'fr', display_name: 'French', enabled: true, sort_order: 1 },
      { code: 'ko', display_name: 'Korean', enabled: true, sort_order: 2 },
    ]
    expect(mergeStudyLanguageEdits(baseline, draft, server)).toEqual([
      { code: 'fr', display_name: 'Français', enabled: true, sort_order: 0 },
      { code: 'en', display_name: 'English', enabled: false, sort_order: 1 },
      { code: 'ko', display_name: 'Korean', enabled: true, sort_order: 2 },
    ])
  })

  it('keeps deliberate draft deletions of baseline languages', () => {
    const server: StudyLanguage[] = [
      { code: 'en', display_name: 'English', enabled: true, sort_order: 0 },
      { code: 'fr', display_name: 'French', enabled: true, sort_order: 1 },
    ]
    const withoutFrench = draft.filter(language => language.code !== 'fr')
    expect(mergeStudyLanguageEdits(baseline, withoutFrench, server)).toEqual([
      { code: 'en', display_name: 'English', enabled: false, sort_order: 0 },
    ])
  })

  it('matches codes case-insensitively via canonicalization', () => {
    const server: StudyLanguage[] = [
      { code: 'pt_br', display_name: 'Português', enabled: true, sort_order: 0 },
    ]
    const draftWithVariant: StudyLanguage[] = [
      { code: 'pt-BR', display_name: 'Portuguese (BR)', enabled: true, sort_order: 0 },
    ]
    expect(mergeStudyLanguageEdits(['pt-br'], draftWithVariant, server)).toEqual([
      { code: 'pt-BR', display_name: 'Portuguese (BR)', enabled: true, sort_order: 0 },
    ])
  })
})
