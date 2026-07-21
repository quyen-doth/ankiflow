import { resolveBuiltinAiOutputProfiles } from '@/lib/ai-agent/builtinOutputProfiles'
import {
  createGenericAiOutputProfiles,
  normalizeAiOutputProfiles,
  parseAiOutputProfiles,
} from '@/lib/ai-agent/outputProfiles'
import { resolveContentTypeFormType } from '@/lib/contentTypes'
import { getContentTypePrimaryFieldKey } from '@/lib/create/formBlueprint'
import { FormType } from '@/types'
import type { AiOutputProfile, FormFieldConfig } from '@/types'

export interface ContentTypeAiProfileSource {
  code: string
  name: string
  fields: FormFieldConfig[]
  ai_output_profiles?: AiOutputProfile[]
}

export interface MaterializedContentTypeAiProfiles {
  primaryFieldKey: string
  usesAiGeneration: boolean
  profiles: AiOutputProfile[]
}

/** Editor 用に stored profiles または built-in/generic fallback を完全な state にする。 */
export function materializeContentTypeAiProfiles(
  source: ContentTypeAiProfileSource,
): MaterializedContentTypeAiProfiles {
  const primaryFieldKey = getContentTypePrimaryFieldKey(source)
  const builtInFormType = resolveContentTypeFormType(source.code)
  const usesAiGeneration = builtInFormType !== FormType.GENERAL

  if (source.ai_output_profiles) {
    return {
      primaryFieldKey,
      usesAiGeneration,
      profiles: parseAiOutputProfiles(source.ai_output_profiles, primaryFieldKey),
    }
  }

  const builtInProfiles = builtInFormType
    ? resolveBuiltinAiOutputProfiles(builtInFormType)
    : null
  const primaryLabel = source.fields.find(field => field.field_key === primaryFieldKey)?.label
    ?? primaryFieldKey
  if (!usesAiGeneration) {
    return { primaryFieldKey, usesAiGeneration, profiles: [] }
  }
  const fallbackProfiles = builtInProfiles ?? createGenericAiOutputProfiles(
    primaryFieldKey,
    primaryLabel,
    source.fields.map(field => field.field_key),
  )
  return {
    primaryFieldKey,
    usesAiGeneration,
    profiles: parseAiOutputProfiles(fallbackProfiles, primaryFieldKey),
  }
}

export function cloneStoredContentTypeAiProfiles(
  source: Pick<ContentTypeAiProfileSource, 'ai_output_profiles'>,
): AiOutputProfile[] {
  return source.ai_output_profiles ? normalizeAiOutputProfiles(source.ai_output_profiles) : []
}
