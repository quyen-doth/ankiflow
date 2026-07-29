import {
  canonicalizeLanguageCode,
  inferLanguageDisplayName,
} from '@/lib/studyLanguages'
import type { AiOutputLanguage, LanguageCode } from '@/types'

export const DEFAULT_AI_OUTPUT_LANGUAGE_CODE: LanguageCode = 'vi'

export const DEFAULT_AI_OUTPUT_LANGUAGES: readonly AiOutputLanguage[] = [
  {
    code: DEFAULT_AI_OUTPUT_LANGUAGE_CODE,
    display_name: 'Vietnamese',
    enabled: true,
    sort_order: 0,
  },
]

export interface NormalizedAiOutputLanguagePreferences {
  languages: AiOutputLanguage[]
  defaultLanguage: LanguageCode
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeDefaultCode(value: unknown): LanguageCode {
  return typeof value === 'string'
    ? canonicalizeLanguageCode(value) ?? DEFAULT_AI_OUTPUT_LANGUAGE_CODE
    : DEFAULT_AI_OUTPUT_LANGUAGE_CODE
}

function fallbackLanguages(defaultCode: LanguageCode): AiOutputLanguage[] {
  return [{
    code: defaultCode,
    display_name: inferLanguageDisplayName(defaultCode),
    enabled: true,
    sort_order: 0,
  }]
}

/**
 * Firestore の tolerant reader。
 *
 * `ai_output_languages` がない legacy document は `ai_output_language` から
 * 1 件のリストを導出する。保存済みリストが壊れている場合も Create を止めない。
 */
export function normalizeAiOutputLanguagePreferences(
  languagesValue: unknown,
  defaultValue: unknown,
): NormalizedAiOutputLanguagePreferences {
  const legacyDefault = normalizeDefaultCode(defaultValue)
  if (!Array.isArray(languagesValue)) {
    return {
      languages: fallbackLanguages(legacyDefault),
      defaultLanguage: legacyDefault,
    }
  }

  const seen = new Set<string>()
  const normalized: Array<AiOutputLanguage & { source_index: number }> = []

  languagesValue.forEach((raw, index) => {
    if (!isRecord(raw) || typeof raw.code !== 'string') return
    const code = canonicalizeLanguageCode(raw.code)
    if (!code) return
    const key = code.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)

    const displayName = typeof raw.display_name === 'string' && raw.display_name.trim()
      ? raw.display_name.trim()
      : inferLanguageDisplayName(code)

    normalized.push({
      code,
      display_name: displayName,
      enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
      sort_order: typeof raw.sort_order === 'number' && Number.isFinite(raw.sort_order)
        ? raw.sort_order
        : index,
      source_index: index,
    })
  })

  if (normalized.length === 0) {
    return {
      languages: fallbackLanguages(legacyDefault),
      defaultLanguage: legacyDefault,
    }
  }

  normalized.sort((left, right) => (
    left.sort_order - right.sort_order || left.source_index - right.source_index
  ))
  const languages = normalized.map((language, index) => ({
    code: language.code,
    display_name: language.display_name,
    enabled: language.enabled,
    sort_order: index,
  }))

  if (!languages.some(language => language.enabled)) languages[0].enabled = true

  const savedDefault = languages.find(language => (
    language.enabled
    && canonicalizeLanguageCode(language.code) === legacyDefault
  ))
  const defaultLanguage = savedDefault?.code
    ?? languages.find(language => language.enabled)!.code

  return { languages, defaultLanguage }
}

/** Settings 保存前の strict validation。 */
export function validateAiOutputLanguagePreferences(
  languages: AiOutputLanguage[],
  defaultLanguage: string,
): string[] {
  const errors: string[] = []
  if (languages.length === 0) return ['Add at least one AI output language.']

  const seen = new Set<string>()
  for (const language of languages) {
    const code = canonicalizeLanguageCode(language.code)
    if (!code) {
      errors.push(`"${language.code}" is not a valid BCP 47 language code.`)
      continue
    }
    const key = code.toLowerCase()
    if (seen.has(key)) errors.push(`AI output language code "${code}" is duplicated.`)
    seen.add(key)
    if (!language.display_name.trim()) {
      errors.push(`Add a display name for AI output language "${code}".`)
    }
  }

  const enabled = languages.filter(language => language.enabled)
  if (enabled.length === 0) {
    errors.push('Keep at least one AI output language enabled.')
  }

  const canonicalDefault = canonicalizeLanguageCode(defaultLanguage)
  if (!canonicalDefault) {
    errors.push('Select a valid default AI output language.')
  } else if (!enabled.some(language => (
    canonicalizeLanguageCode(language.code) === canonicalDefault
  ))) {
    errors.push('Default AI output language must be enabled in your AI output languages.')
  }

  return errors
}

/** 既存 code は custom display name を保持したまま再有効化する。 */
export function addOrEnableAiOutputLanguage(
  languages: AiOutputLanguage[],
  candidate: Pick<AiOutputLanguage, 'code' | 'display_name'>,
): AiOutputLanguage[] {
  const code = canonicalizeLanguageCode(candidate.code)
  if (!code) throw new Error(`Invalid BCP 47 language code: ${candidate.code}`)

  const existingIndex = languages.findIndex(language => (
    canonicalizeLanguageCode(language.code) === code
  ))
  if (existingIndex >= 0) {
    return languages.map((language, index) => (
      index === existingIndex ? { ...language, enabled: true } : { ...language }
    ))
  }

  return [
    ...languages.map(language => ({ ...language })),
    {
      code,
      display_name: candidate.display_name.trim() || inferLanguageDisplayName(code),
      enabled: true,
      sort_order: languages.length,
    },
  ]
}
