import { FormType } from '@/types'
import { resolveBuiltinAiOutputProfiles } from '@/lib/ai-agent/builtinOutputProfiles'
import { createGenericAiOutputProfiles } from '@/lib/ai-agent/outputProfiles'
import { inferLanguageDisplayName } from '@/lib/studyLanguages'
import { buildEngineCardSpec } from './promptEngine'
import type { EngineDefinition } from './promptEngine'
import type { GenerateCardInput } from './types'
import type { CardSpec } from './card-spec'

export { TOOL_NAME, toToolInputSchema } from './card-spec'
export type { CardSpec } from './card-spec'

function fallbackFieldLabels(
  primaryFieldKey: string,
  primaryLabel: string,
  fields?: Record<string, string>,
): Record<string, string> {
  return {
    ...Object.fromEntries(Object.keys(fields ?? {}).map(key => [key, key])),
    [primaryFieldKey]: primaryLabel,
  }
}

/** Build an engine definition for old requests that do not carry an authoritative workspace definition. */
function buildFallbackDefinition(input: GenerateCardInput): EngineDefinition {
  if (input.form_type === FormType.LANGUAGE && input.word && input.language) {
    return {
      name: input.contentTypeName?.trim() || 'Language',
      primary_field_key: 'word',
      ai_output_profiles: resolveBuiltinAiOutputProfiles(FormType.LANGUAGE)!,
      field_labels: fallbackFieldLabels('word', 'Vocabulary item', input.dynamicFields),
    }
  }

  if (input.form_type === FormType.IT && input.term) {
    return {
      name: input.contentTypeName?.trim() || 'IT Vocabulary',
      primary_field_key: 'term',
      ai_output_profiles: resolveBuiltinAiOutputProfiles(FormType.IT)!,
      field_labels: fallbackFieldLabels('term', 'Technical term', input.dynamicFields),
    }
  }

  if (input.form_type !== FormType.GENERAL && input.word) {
    const fieldKeys = Object.keys(input.dynamicFields ?? {})
    return {
      name: input.contentTypeName?.trim() || input.form_type,
      primary_field_key: 'word',
      ai_output_profiles: createGenericAiOutputProfiles('word', 'Primary value', fieldKeys),
      field_labels: fallbackFieldLabels('word', 'Primary value', input.dynamicFields),
    }
  }

  throw new Error('Invalid parameters for generating content')
}

/** Resolve every request through the data-driven prompt engine. */
export function resolveCardSpec(input: GenerateCardInput): CardSpec {
  const definition = input.content_type ?? buildFallbackDefinition(input)
  const primaryValue = input.form_type === FormType.IT
    ? input.term
    : input.word
  if (!primaryValue) throw new Error('Invalid parameters for generating content')

  const outputLanguageCode = input.output_language ?? 'vi'
  return buildEngineCardSpec({
    definition,
    ...(input.language
      ? {
          studyLanguage: {
            code: input.language,
            name: input.language_name?.trim() || inferLanguageDisplayName(input.language),
          },
        }
      : {}),
    outputLanguage: {
      code: outputLanguageCode,
      name: input.output_language_name?.trim() || inferLanguageDisplayName(outputLanguageCode),
    },
    primaryValue,
    formValues: input.dynamicFields,
    topics: input.topics,
  })
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

/** Restore trusted identity and compatibility aliases after validating model output. */
export function normalizeGeneratedCard(
  input: GenerateCardInput,
  generated: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = { ...generated }
  const primaryKey = input.content_type?.primary_field_key
    ?? (input.form_type === FormType.IT ? 'term' : 'word')
  const primaryValue = input.form_type === FormType.IT
    ? input.term
    : input.word

  if (primaryValue) normalized[primaryKey] = primaryValue

  const wordType = nonEmptyString(normalized.word_type)
    ?? nonEmptyString(normalized.word_type_vi)
  if (wordType) normalized.word_type = wordType

  const definition = nonEmptyString(normalized.definition)
    ?? nonEmptyString(normalized.definition_vi)
  if (definition) normalized.definition = definition

  return normalized
}
