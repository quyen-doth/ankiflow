import { z } from 'zod'
import { AI_OUTPUT_FIELD_KEY_PATTERN } from '@/lib/ai-agent/outputProfiles'
import type { BuiltinCardFieldSource, CardFieldSource, CardTemplate } from '@/types'

export const BUILTIN_CARD_FIELD_SOURCES = [
  'word',
  'reading',
  'han_viet',
  'meaning',
  'word_type',
  'example',
  'example_blank',
  'translation',
  'collocations',
  'image',
  'audio',
] as const satisfies readonly BuiltinCardFieldSource[]

const BUILTIN_CARD_FIELD_SOURCE_SET = new Set<string>(BUILTIN_CARD_FIELD_SOURCES)
const CUSTOM_FIELD_PREFIX = 'custom:'

/** custom source を検証し、有効な AI output key だけを返す。 */
export function parseCustomFieldSource(source: string): string | null {
  if (!source.startsWith(CUSTOM_FIELD_PREFIX)) return null
  const key = source.slice(CUSTOM_FIELD_PREFIX.length)
  return AI_OUTPUT_FIELD_KEY_PATTERN.test(key) ? key : null
}

export function isCardFieldSource(value: unknown): value is CardFieldSource {
  return typeof value === 'string'
    && (BUILTIN_CARD_FIELD_SOURCE_SET.has(value) || parseCustomFieldSource(value) !== null)
}

export const cardFieldSourceSchema = z.custom<CardFieldSource>(isCardFieldSource, {
  message: 'Card field source must be a supported built-in field or custom:<lowercase_snake_case>',
})

export const cardTemplateSchema: z.ZodType<CardTemplate> = z.object({
  front: z.array(cardFieldSourceSchema).min(1),
  back: z.array(cardFieldSourceSchema).min(1),
})
