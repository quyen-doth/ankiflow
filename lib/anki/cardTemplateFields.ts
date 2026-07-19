import { materializeContentTypeAiProfiles } from '@/lib/ai-agent/contentTypeProfiles'
import { selectAiOutputProfile } from '@/lib/ai-agent/outputProfiles'
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

export interface CardTemplateCustomField {
  key: string
  source: `custom:${string}`
  label: string
  sampleValue: string | string[]
}

/** Card Type の route/language に一致する profile から custom block 候補を作る。 */
export function resolveCardTemplateCustomFields(
  contentTypes: readonly ContentType[],
  formType: string,
  language: string | null,
): CardTemplateCustomField[] {
  const contentType = prepareRuntimeContentTypes(contentTypes).contentTypes.find(candidate => (
    resolveRuntimeContentTypeCode(candidate.code) === formType
  ))
  if (!contentType) return []

  try {
    const materialized = materializeContentTypeAiProfiles(contentType)
    if (materialized.profiles.length === 0) return []
    const profile = selectAiOutputProfile(
      materialized.profiles,
      language ? primaryLanguageSubtag(language) : null,
    )
    const fieldLabels = Object.fromEntries(
      contentType.fields.map(field => [field.field_key, field.label]),
    )
    const seen = new Set<string>()

    return profile.fields.flatMap(field => {
      if (BUILTIN_RENDERED_OUTPUT_KEYS.has(field.key) || seen.has(field.key)) return []
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
