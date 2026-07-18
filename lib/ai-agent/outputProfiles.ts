import { z } from 'zod'
import type { AiOutputProfile } from '@/types'

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
  fields: z.array(aiOutputFieldSchema).min(1).max(MAX_AI_OUTPUT_FIELDS),
}).superRefine((profile, ctx) => {
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

/** Parse + clone を行い、Firestore/client object を engine 内で変更しない。 */
export function parseAiOutputProfiles(input: unknown, primaryFieldKey?: string): AiOutputProfile[] {
  const profiles = aiOutputProfilesSchema.parse(input)
  if (primaryFieldKey) {
    for (const profile of profiles) {
      const primaryField = profile.fields.find(field => field.key === primaryFieldKey)
      if (!primaryField) {
        throw new Error(`AI output profile "${profile.profile}" must include primary field "${primaryFieldKey}"`)
      }
      if ((primaryField.include_when ?? 'always') !== 'always') {
        throw new Error(`Primary field "${primaryFieldKey}" must always be included`)
      }
    }
  }
  return profiles.map(profile => ({
    profile: profile.profile,
    fields: profile.fields.map(field => ({ ...field })),
  }))
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
