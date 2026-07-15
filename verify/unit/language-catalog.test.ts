import { describe, expect, it } from 'vitest'
import {
  LANGUAGE_CATALOG_CODES,
  listLanguageCatalog,
} from '@/lib/languageCatalog'
import { canonicalizeLanguageCode } from '@/lib/studyLanguages'

describe('languageCatalog', () => {
  it('contains only valid BCP 47 codes', () => {
    expect(LANGUAGE_CATALOG_CODES.every(code => canonicalizeLanguageCode(code) !== null)).toBe(true)
  })

  it('does not contain duplicate canonical codes', () => {
    const codes = LANGUAGE_CATALOG_CODES.map(code => canonicalizeLanguageCode(code))
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('contains the core application languages', () => {
    expect(LANGUAGE_CATALOG_CODES).toEqual(expect.arrayContaining(['vi', 'en', 'ja', 'zh']))
  })

  it('returns non-empty display names sorted by display name', () => {
    const catalog = listLanguageCatalog()
    expect(catalog.every(language => language.display_name.trim().length > 0)).toBe(true)
    expect(catalog).toEqual([...catalog].sort((a, b) => (
      a.display_name.localeCompare(b.display_name, 'en') || a.code.localeCompare(b.code, 'en')
    )))
  })
})
