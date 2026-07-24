import { materializeContentTypeAiProfiles } from '@/lib/ai-agent/contentTypeProfiles'
import {
  resolveEffectiveProfileFields,
  selectAiOutputProfile,
} from '@/lib/ai-agent/outputProfiles'
import { getAiOutputProfileLabel } from '@/lib/ai-agent/profileOverrides'
import { prepareRuntimeContentTypes, resolveRuntimeContentTypeCode } from '@/lib/contentTypes'
import { getFieldLabel } from '@/lib/anki/renderCard'
import { primaryLanguageSubtag } from '@/lib/studyLanguages'
import type { ContentType } from '@/types'

const BUILTIN_RENDERED_OUTPUT_KEYS = new Set([
  'word',
  'term',
  'title',
  'pinyin',
  'hiragana',
  'ipa',
  'han_viet',
  'meaning_vi',
  'definition',
  'definition_vi',
  'content',
  'word_type',
  'word_type_vi',
  'example_sentence',
  'example_blank',
  'example_translation',
  'collocations',
  'unsplash_search_keyword',
  'image_url',
  'image_credit',
  'audio_url',
  'audio_example_url',
])

/** 固定 CardFieldSource ですでに扱う AI output key かを判定する。 */
export function isBuiltinRenderedOutputKey(key: string): boolean {
  return BUILTIN_RENDERED_OUTPUT_KEYS.has(key)
}

export interface CardTemplateCustomField {
  key: string
  source: `custom:${string}`
  label: string
  sampleValue: string | string[]
}

export interface UnavailableTemplateFieldExplanation {
  key: string
  reason: 'excluded' | 'missing'
  profileLabel: string
  contentTypeId: string
}

function resolveMatchingContentType(
  contentTypes: readonly ContentType[],
  formType: string,
): ContentType | undefined {
  return prepareRuntimeContentTypes(contentTypes).contentTypes.find(candidate => (
    resolveRuntimeContentTypeCode(candidate.code) === formType
  ))
}

/** Card Type の route/language に一致する profile から custom block 候補を作る。 */
export function resolveCardTemplateCustomFields(
  contentTypes: readonly ContentType[],
  formType: string,
  language: string | null,
): CardTemplateCustomField[] {
  const contentType = resolveMatchingContentType(contentTypes, formType)
  if (!contentType) return []

  try {
    const materialized = materializeContentTypeAiProfiles(contentType)
    if (materialized.profiles.length === 0) return []
    const fields = resolveEffectiveProfileFields(
      materialized.profiles,
      language ? primaryLanguageSubtag(language) : null,
    )
    const fieldLabels = Object.fromEntries(
      contentType.fields.map(field => [field.field_key, field.label]),
    )
    const seen = new Set<string>()

    return fields.flatMap(field => {
      if (isBuiltinRenderedOutputKey(field.key) || seen.has(field.key)) return []
      seen.add(field.key)
      const source = `custom:${field.key}` as const
      const label = getFieldLabel(source, fieldLabels)
      return [{
        key: field.key,
        source,
        label,
        sampleValue: field.type === 'string_array'
          ? [`Sample ${label} 1`, `Sample ${label} 2`]
          : `Sample ${label}`,
      }]
    })
  } catch {
    return []
  }
}

/**
 * Template に残っている custom field が現在の effective profile で使えない理由を返す。
 * Content Type 読み込み・profile validation が失敗した場合は誤診を避けて空配列にする。
 */
export function explainUnavailableTemplateFields(
  contentTypes: readonly ContentType[],
  formType: string,
  language: string | null,
  keys: readonly string[],
): UnavailableTemplateFieldExplanation[] {
  const contentType = resolveMatchingContentType(contentTypes, formType)
  if (!contentType) return []

  try {
    const materialized = materializeContentTypeAiProfiles(contentType)
    if (materialized.profiles.length === 0) return []
    const languageSubtag = language ? primaryLanguageSubtag(language) : null
    const selectedProfile = selectAiOutputProfile(materialized.profiles, languageSubtag)
    const effectiveKeys = new Set(
      resolveEffectiveProfileFields(materialized.profiles, languageSubtag)
        .map(field => field.key),
    )
    const excludedKeys = new Set(selectedProfile.exclude ?? [])
    const seen = new Set<string>()

    return keys.flatMap(key => {
      if (!key || seen.has(key) || effectiveKeys.has(key)) return []
      seen.add(key)
      return [{
        key,
        reason: excludedKeys.has(key) ? 'excluded' as const : 'missing' as const,
        profileLabel: getAiOutputProfileLabel(selectedProfile.profile),
        contentTypeId: contentType.id,
      }]
    })
  } catch {
    return []
  }
}
