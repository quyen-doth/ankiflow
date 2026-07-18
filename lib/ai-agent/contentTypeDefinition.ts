import { z } from 'zod'
import { CONTENT_TYPE_CODE_PATTERN } from '@/lib/constants'
import { formFieldConfigSchema, resolveRuntimeContentTypeCode } from '@/lib/contentTypes'
import { getContentTypePrimaryFieldKey } from '@/lib/create/formBlueprint'
import { parseAiOutputProfiles } from '@/lib/ai-agent/outputProfiles'
import type { EngineDefinition } from '@/lib/ai-agent/promptEngine'

const generationFieldSchema = formFieldConfigSchema.extend({
  field_key: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(80),
})

const storedContentTypeSchema = z.object({
  user_id: z.string().trim().min(1).max(128),
  code: z.string().trim().regex(CONTENT_TYPE_CODE_PATTERN),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  fields: z.array(generationFieldSchema).min(1).max(40),
  ai_output_profiles: z.unknown().optional(),
})

export interface GenerationContentTypeDocument {
  userId: string
  code: string
  routingCode: string
  name: string
  definition?: EngineDefinition
}

/** Firestore document を bounded な generate 用 definition に変換する pure parser。 */
export function parseGenerationContentTypeDocument(input: unknown): GenerationContentTypeDocument {
  const parsed = storedContentTypeSchema.parse(input)
  const primaryFieldKey = getContentTypePrimaryFieldKey(parsed)
  const profiles = parsed.ai_output_profiles === undefined
    ? undefined
    : parseAiOutputProfiles(parsed.ai_output_profiles, primaryFieldKey)

  return {
    userId: parsed.user_id,
    code: parsed.code,
    routingCode: resolveRuntimeContentTypeCode(parsed.code),
    name: parsed.name,
    ...(profiles
      ? {
          definition: {
            name: parsed.name,
            ...(parsed.description.trim() ? { description: parsed.description.trim() } : {}),
            primary_field_key: primaryFieldKey,
            ai_output_profiles: profiles,
            field_labels: Object.fromEntries(parsed.fields.map(field => [field.field_key, field.label])),
          },
        }
      : {}),
  }
}
