import { z } from 'zod'
import type { AiOutputField, AiOutputProfile } from '@/types'

export const AI_OUTPUT_FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/
export const AI_OUTPUT_PROFILE_KEY_PATTERN = /^(?:default|[a-z]{2,8})$/
export const DEFAULT_AI_ARRAY_MAX_ITEMS = 10
export const MAX_AI_OUTPUT_FIELDS = 30
export const MAX_AI_OUTPUT_PROFILES = 20

/**
 * AI content が application/session metadata を上書きしないための denylist。
 * Primary content (`word` / `term` / custom primary key) はこの list に含めない。
 */
export const RESERVED_AI_OUTPUT_KEYS = new Set([
  'id',
  'user_id',
  'source_content_type_id',
  'form_type',
  'language',
  'output_language',
  'category_id',
  'anki_deck',
  'anki_note_ids',
  'card_type_ids',
  'topic_ids',
  'tags',
  'difficulty',
  'note',
  'image_url',
  'image_credit',
  'audio_url',
  'audio_example_url',
  'review_state',
  'integration_source',
  'source_url',
  'source_title',
  'context_quote',
  'status',
  'created_at',
  'updated_at',
])

export const aiOutputFieldSchema = z.object({
  key: z.string()
    .trim()
    .regex(AI_OUTPUT_FIELD_KEY_PATTERN, 'AI output key must use lowercase snake_case and start with a letter')
    .refine(key => !RESERVED_AI_OUTPUT_KEYS.has(key), 'AI output key is reserved by the application'),
  type: z.enum(['string', 'string_array']),
  instruction: z.string().trim().min(1).max(300),
  include_when: z.enum(['always', 'output_vi']).optional(),
  max_items: z.number().int().min(1).max(20).optional(),
}).superRefine((field, ctx) => {
  if (field.type === 'string' && field.max_items !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['max_items'],
      message: 'max_items is only valid for string_array fields',
    })
  }
})

export const aiOutputProfileSchema = z.object({
  profile: z.string()
    .trim()
    .regex(AI_OUTPUT_PROFILE_KEY_PATTERN, 'AI output profile must be "default" or a primary language subtag'),
  fields: z.array(aiOutputFieldSchema).max(MAX_AI_OUTPUT_FIELDS),
  inherit: z.literal(true).optional(),
  exclude: z.array(
    z.string()
      .trim()
      .regex(AI_OUTPUT_FIELD_KEY_PATTERN, 'Excluded AI output key must use lowercase snake_case'),
  ).max(MAX_AI_OUTPUT_FIELDS).optional(),
}).superRefine((profile, ctx) => {
  if (profile.profile === 'default') {
    if (profile.fields.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['fields'],
        message: 'Default AI output profile must include at least one field',
      })
    }
    if (profile.inherit !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['inherit'],
        message: 'Default AI output profile cannot inherit another profile',
      })
    }
    if (profile.exclude !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['exclude'],
        message: 'Default AI output profile cannot exclude inherited fields',
      })
    }
  } else if (profile.exclude !== undefined && profile.inherit !== true) {
    ctx.addIssue({
      code: 'custom',
      path: ['exclude'],
      message: 'Excluded fields require profile inheritance',
    })
  }

  const seen = new Map<string, number>()
  profile.fields.forEach((field, index) => {
    const firstIndex = seen.get(field.key)
    if (firstIndex !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['fields', index, 'key'],
        message: `AI output key must be unique; it duplicates fields.${firstIndex}.key`,
      })
      return
    }
    seen.set(field.key, index)
  })

  const seenExcluded = new Map<string, number>()
  profile.exclude?.forEach((key, index) => {
    const firstIndex = seenExcluded.get(key)
    if (firstIndex !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['exclude', index],
        message: `Excluded AI output key must be unique; it duplicates exclude.${firstIndex}`,
      })
      return
    }
    seenExcluded.set(key, index)
  })
})

export const aiOutputProfilesSchema = z.array(aiOutputProfileSchema)
  .min(1)
  .max(MAX_AI_OUTPUT_PROFILES)
  .superRefine((profiles, ctx) => {
    const seen = new Map<string, number>()
    profiles.forEach((profile, index) => {
      const firstIndex = seen.get(profile.profile)
      if (firstIndex !== undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'profile'],
          message: `AI output profile must be unique; it duplicates ${firstIndex}.profile`,
        })
        return
      }
      seen.set(profile.profile, index)
    })
    if (!seen.has('default')) {
      ctx.addIssue({
        code: 'custom',
        path: [],
        message: 'AI output profiles must include a default profile',
      })
    }
  })

/** Legacy profile を明示的な inheritance state に変換し、入力 object は変更しない。 */
export function normalizeAiOutputProfiles(
  profiles: readonly AiOutputProfile[],
): AiOutputProfile[] {
  const defaultProfile = profiles.find(profile => profile.profile === 'default')
  const defaultKeys = defaultProfile?.fields.map(field => field.key) ?? []

  return profiles.map(profile => {
    const fields = profile.fields.map(field => ({ ...field }))
    if (profile.profile === 'default') {
      return { profile: profile.profile, fields }
    }

    const ownKeys = new Set(profile.fields.map(field => field.key))
    return {
      profile: profile.profile,
      fields,
      inherit: true,
      exclude: profile.inherit === true
        ? [...(profile.exclude ?? [])]
        : defaultKeys.filter(key => !ownKeys.has(key)),
    }
  })
}

function effectiveProfileFields(
  profiles: readonly AiOutputProfile[],
  primaryStudyLanguage: string | null,
): AiOutputField[] {
  const selected = selectAiOutputProfile(profiles, primaryStudyLanguage)
  if (selected.profile === 'default') {
    return selected.fields.map(field => ({ ...field }))
  }

  const fallback = profiles.find(profile => profile.profile === 'default')
  if (!fallback) throw new Error('AI output profiles must include a default profile')
  const ownKeys = new Set(selected.fields.map(field => field.key))
  const excludedKeys = new Set(selected.exclude ?? [])

  return [
    ...selected.fields.map(field => ({ ...field })),
    ...fallback.fields
      .filter(field => !ownKeys.has(field.key) && !excludedKeys.has(field.key))
      .map(field => ({ ...field })),
  ]
}

/** Language profile の own fields と継承される Default fields を順序を保って解決する。 */
export function resolveEffectiveProfileFields(
  profiles: readonly AiOutputProfile[],
  primaryStudyLanguage: string | null,
): AiOutputField[] {
  return effectiveProfileFields(normalizeAiOutputProfiles(profiles), primaryStudyLanguage)
}

/** Parse + normalize + clone を行い、Firestore/client object を engine 内で変更しない。 */
export function parseAiOutputProfiles(input: unknown, primaryFieldKey?: string): AiOutputProfile[] {
  const profiles = normalizeAiOutputProfiles(aiOutputProfilesSchema.parse(input))
  if (primaryFieldKey) {
    for (const profile of profiles) {
      if (profile.exclude?.includes(primaryFieldKey)) {
        throw new Error(`AI output profile "${profile.profile}" cannot exclude primary field "${primaryFieldKey}"`)
      }
      const primaryField = effectiveProfileFields(
        profiles,
        profile.profile === 'default' ? null : profile.profile,
      ).find(field => field.key === primaryFieldKey)
      if (!primaryField) {
        throw new Error(`AI output profile "${profile.profile}" must include primary field "${primaryFieldKey}"`)
      }
      if ((primaryField.include_when ?? 'always') !== 'always') {
        throw new Error(`Primary field "${primaryFieldKey}" must always be included`)
      }
    }
  }
  return cloneAiOutputProfiles(profiles)
}

/** Firestore/default data と editor state が object を共有しないよう deep clone する。 */
export function cloneAiOutputProfiles(profiles: readonly AiOutputProfile[]): AiOutputProfile[] {
  return profiles.map(profile => ({
    profile: profile.profile,
    fields: profile.fields.map(field => ({ ...field })),
    ...(profile.inherit === true ? { inherit: true as const } : {}),
    ...(profile.exclude !== undefined ? { exclude: [...profile.exclude] } : {}),
  }))
}

/** Profile 未設定の custom Content Type/request を engine definition に materialize する。 */
export function createGenericAiOutputProfiles(
  primaryFieldKey: string,
  primaryFieldLabel = primaryFieldKey,
  additionalFieldKeys: readonly string[] = [],
): AiOutputProfile[] {
  const genericFields = [
    {
      key: primaryFieldKey,
      type: 'string' as const,
      instruction: `Primary value for ${primaryFieldLabel}`,
    },
    {
      key: 'meaning_vi',
      type: 'string' as const,
      instruction: 'Meaning or explanation in {output_language}',
    },
    {
      key: 'example_sentence',
      type: 'string' as const,
      instruction: 'Short illustrative example sentence',
    },
    {
      key: 'example_translation',
      type: 'string' as const,
      instruction: '{output_language} translation of the example sentence',
    },
    {
      key: 'unsplash_search_keyword',
      type: 'string' as const,
      instruction: 'Short English keyword for an illustration image search',
    },
    ...additionalFieldKeys
      .filter(key => AI_OUTPUT_FIELD_KEY_PATTERN.test(key) && !RESERVED_AI_OUTPUT_KEYS.has(key))
      .map(key => ({
        key,
        type: 'string' as const,
        instruction: `Additional content for ${key}`,
      })),
  ].filter((field, index, fields) => (
    fields.findIndex(candidate => candidate.key === field.key) === index
  )).slice(0, MAX_AI_OUTPUT_FIELDS)

  return parseAiOutputProfiles(
    [{ profile: 'default', fields: genericFields }],
    primaryFieldKey,
  )
}

/** study language に一致する profile、なければ default を返す。 */
export function selectAiOutputProfile(
  profiles: readonly AiOutputProfile[],
  primaryStudyLanguage: string | null,
): AiOutputProfile {
  const selected = primaryStudyLanguage
    ? profiles.find(profile => profile.profile === primaryStudyLanguage)
    : undefined
  const fallback = profiles.find(profile => profile.profile === 'default')
  if (!selected && !fallback) throw new Error('AI output profiles must include a default profile')
  return selected ?? fallback!
}
