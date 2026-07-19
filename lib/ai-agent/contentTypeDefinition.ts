import { z } from 'zod'
import { CONTENT_TYPE_CODE_PATTERN } from '@/lib/constants'
import { formFieldConfigSchema, resolveRuntimeContentTypeCode } from '@/lib/contentTypes'
import { materializeContentTypeAiProfiles } from '@/lib/ai-agent/contentTypeProfiles'
import { aiOutputProfilesSchema } from '@/lib/ai-agent/outputProfiles'
import type { EngineDefinition } from '@/lib/ai-agent/promptEngine'

const generationFieldSchema = formFieldConfigSchema.extend({
  field_key: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(80),
})

const inlineGenerationFieldSchema = generationFieldSchema.extend({
  placeholder: z.string().max(500).nullable().optional(),
  data_source: z.string().max(100).nullable().optional(),
  options: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
})

const generationContentTypeSchema = z.object({
  code: z.string().trim().regex(CONTENT_TYPE_CODE_PATTERN),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional().default(''),
  fields: z.array(generationFieldSchema).min(1).max(40),
  ai_output_profiles: aiOutputProfilesSchema.optional(),
})

export const generationContentTypeInlineSchema = generationContentTypeSchema.extend({
  fields: z.array(inlineGenerationFieldSchema).min(1).max(40),
})

const storedContentTypeSchema = generationContentTypeSchema.extend({
  user_id: z.string().trim().min(1).max(128),
})

export interface ParsedGenerationContentType {
  code: string
  routingCode: string
  name: string
  definition?: EngineDefinition
}

export interface GenerationContentTypeDocument extends ParsedGenerationContentType {
  userId: string
}

function buildGenerationContentType(
  parsed: z.infer<typeof generationContentTypeSchema>,
): ParsedGenerationContentType {
  const materialized = materializeContentTypeAiProfiles(parsed)

  return {
    code: parsed.code,
    routingCode: resolveRuntimeContentTypeCode(parsed.code),
    name: parsed.name,
    ...(materialized.usesAiGeneration
      ? {
          definition: {
            name: parsed.name,
            ...(parsed.description.trim() ? { description: parsed.description.trim() } : {}),
            primary_field_key: materialized.primaryFieldKey,
            ai_output_profiles: materialized.profiles,
            field_labels: Object.fromEntries(parsed.fields.map(field => [field.field_key, field.label])),
          },
        }
      : {}),
  }
}

/** Firestore document を bounded な generate 用 definition に変換する pure parser。 */
export function parseGenerationContentTypeDocument(input: unknown): GenerationContentTypeDocument {
  const parsed = storedContentTypeSchema.parse(input)
  return {
    userId: parsed.user_id,
    ...buildGenerationContentType(parsed),
  }
}

/** Editor の未保存 draft を同じ bounded definition に変換する pure parser。 */
export function parseInlineGenerationContentType(input: unknown): ParsedGenerationContentType {
  return buildGenerationContentType(generationContentTypeInlineSchema.parse(input))
}
