import { materializeContentTypeAiProfiles } from '@/lib/ai-agent/contentTypeProfiles'
import {
  AI_OUTPUT_FIELD_KEY_PATTERN,
  RESERVED_AI_OUTPUT_KEYS,
  selectAiOutputProfile,
} from '@/lib/ai-agent/outputProfiles'
import { isBuiltinRenderedOutputKey } from '@/lib/anki/cardTemplateFields'
import { getFieldLabel } from '@/lib/anki/renderCard'
import { prepareRuntimeContentTypes, resolveRuntimeContentTypeCode } from '@/lib/contentTypes'
import { primaryLanguageSubtag } from '@/lib/studyLanguages'
import type { ContentType, Entry } from '@/types'

export interface EntryCustomField {
  key: string
  label: string
  value: string | string[]
}

/** Entry の routing key に対応する active/non-conflicting Content Type を返す。 */
export function findEntryContentType<T extends ContentType>(
  contentTypes: readonly T[],
  formType: string | undefined,
): T | undefined {
  if (!formType) return undefined
  const routingCode = resolveRuntimeContentTypeCode(formType)
  return prepareRuntimeContentTypes(contentTypes).contentTypes.find(contentType => (
    resolveRuntimeContentTypeCode(contentType.code) === routingCode
  ))
}

function fieldLabel(contentType: ContentType | undefined, key: string): string {
  const labels = Object.fromEntries(
    contentType?.fields.map(field => [field.field_key, field.label]) ?? [],
  )
  return getFieldLabel(`custom:${key}`, labels)
}

function isAdditionalFieldKey(key: string): boolean {
  return AI_OUTPUT_FIELD_KEY_PATTERN.test(key)
    && !RESERVED_AI_OUTPUT_KEYS.has(key)
    && !isBuiltinRenderedOutputKey(key)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

/** Profile の type 変更後も保存済み custom value を失わない形へ明示的に変換する。 */
function coerceStoredCustomValue(
  value: unknown,
  targetType: 'string' | 'string_array',
): string | string[] {
  if (targetType === 'string_array') {
    if (isStringArray(value)) return value.slice()
    return typeof value === 'string' && value ? [value] : []
  }

  if (typeof value === 'string') return value
  return isStringArray(value) ? value.join('\n') : ''
}

/**
 * Active AI profile と Entry に残る未知 key の和集合から編集可能な追加 field を作る。
 * Profile から削除済みの既存データも Entry 側の走査で保持する。
 */
export function resolveCustomFields(
  entry: Partial<Entry>,
  contentType?: ContentType,
): EntryCustomField[] {
  const entryData = entry as Record<string, unknown>
  const fields: EntryCustomField[] = []
  const seen = new Set<string>()

  if (contentType) {
    try {
      const materialized = materializeContentTypeAiProfiles(contentType)
      if (materialized.profiles.length > 0) {
        const profile = selectAiOutputProfile(
          materialized.profiles,
          entry.language ? primaryLanguageSubtag(entry.language) : null,
        )
        for (const profileField of profile.fields) {
          if (!isAdditionalFieldKey(profileField.key) || seen.has(profileField.key)) continue
          const storedValue = entryData[profileField.key]
          fields.push({
            key: profileField.key,
            label: fieldLabel(contentType, profileField.key),
            value: coerceStoredCustomValue(storedValue, profileField.type),
          })
          seen.add(profileField.key)
        }
      }
    } catch {
      // 不正な legacy profile でも Entry に残る custom data は下の fallback で表示する。
    }
  }

  for (const [key, value] of Object.entries(entryData)) {
    if (seen.has(key) || !isAdditionalFieldKey(key)) continue
    if (typeof value !== 'string' && !isStringArray(value)) continue
    fields.push({
      key,
      label: fieldLabel(contentType, key),
      value: typeof value === 'string' ? value : value.slice(),
    })
    seen.add(key)
  }

  return fields
}
