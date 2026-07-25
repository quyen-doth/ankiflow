import { DEFAULT_AI_ARRAY_MAX_ITEMS } from '@/lib/ai-agent/outputProfiles'
import type { AiOutputField, AiOutputProfile } from '@/types'

const PROFILE_LABELS: Readonly<Record<string, string>> = {
  default: 'Default',
  en: 'English',
  zh: 'Chinese',
  ja: 'Japanese',
}

export interface DefaultFieldOverride {
  profile: string
  label: string
  diffs: string[]
}

export function getAiOutputProfileLabel(profile: string): string {
  return PROFILE_LABELS[profile] ?? (profile ? profile.toUpperCase() : 'New profile')
}

function effectiveMaxItems(field: AiOutputField): number | null {
  return field.type === 'string_array'
    ? field.max_items ?? DEFAULT_AI_ARRAY_MAX_ITEMS
    : null
}

/** Default field を own field で上書きする profile と、表示用の差分を解決する。 */
function describeOverride(defaultField: AiOutputField, ownField: AiOutputField): string[] {
  const diffs: string[] = []

  if (ownField.type !== defaultField.type) {
    diffs.push(ownField.type === 'string_array' ? 'list' : 'text')
  }

  const defaultMax = effectiveMaxItems(defaultField)
  const ownMax = effectiveMaxItems(ownField)
  if (ownMax !== defaultMax && ownMax !== null) {
    diffs.push(`max ${ownMax}`)
  }

  const defaultCondition = defaultField.include_when ?? 'always'
  const ownCondition = ownField.include_when ?? 'always'
  if (ownCondition !== defaultCondition) {
    diffs.push(ownCondition === 'output_vi' ? 'Vietnamese only' : 'always')
  }

  return diffs
}

/**
 * Default の各 field に対して、同じ key の own field を持つ非 Default profile を返す。
 * instruction だけが異なる場合も override だが、badge を短く保つため差分文言は付けない。
 */
export function resolveDefaultFieldOverrides(
  profiles: readonly AiOutputProfile[],
): Map<string, DefaultFieldOverride[]> {
  const result = new Map<string, DefaultFieldOverride[]>()
  const defaultProfile = profiles.find(profile => profile.profile === 'default')
  if (!defaultProfile) return result

  const languageProfiles = profiles.filter(profile => profile.profile !== 'default')
  for (const defaultField of defaultProfile.fields) {
    const overrides = languageProfiles.flatMap(profile => {
      const ownField = profile.fields.find(field => field.key === defaultField.key)
      if (!ownField) return []
      return [{
        profile: profile.profile,
        label: getAiOutputProfileLabel(profile.profile),
        diffs: describeOverride(defaultField, ownField),
      }]
    })
    if (overrides.length > 0) result.set(defaultField.key, overrides)
  }

  return result
}
