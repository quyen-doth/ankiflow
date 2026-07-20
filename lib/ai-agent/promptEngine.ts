import { z } from 'zod'
import { inferLanguageDisplayName, primaryLanguageSubtag } from '@/lib/studyLanguages'
import { getLanguageProfile } from '@/lib/ai-agent/languageProfiles'
import {
  DEFAULT_AI_ARRAY_MAX_ITEMS,
  parseAiOutputProfiles,
  resolveEffectiveProfileFields,
} from '@/lib/ai-agent/outputProfiles'
import { TOOL_NAME, toToolInputSchema } from '@/lib/ai-agent/card-spec'
import type { AiOutputProfile } from '@/types'
import type { CardSpec } from '@/lib/ai-agent/card-spec'

export interface EngineDefinition {
  name: string
  description?: string
  primary_field_key: string
  ai_output_profiles: AiOutputProfile[]
  field_labels?: Record<string, string>
}

export interface EngineLanguage {
  code: string
  name: string
}

export interface BuildEngineCardSpecArgs {
  definition: EngineDefinition
  studyLanguage?: EngineLanguage
  outputLanguage: EngineLanguage
  primaryValue: string
  formValues?: Record<string, string>
  topics?: string[]
}

function resolveTemplate(
  template: string,
  outputLanguage: EngineLanguage,
  studyLanguage: EngineLanguage | undefined,
  definitionName: string,
): string {
  return template
    .replaceAll('{output_language}', outputLanguage.name)
    .replaceAll('{study_language}', studyLanguage?.name ?? definitionName)
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function activeFields(
  profiles: AiOutputProfile[],
  primaryStudyLanguage: string | null,
  outputLanguageCode: string,
) {
  const outputPrimary = primaryLanguageSubtag(outputLanguageCode)
  return resolveEffectiveProfileFields(profiles, primaryStudyLanguage).filter(outputField => (
    outputField.include_when !== 'output_vi' || outputPrimary === 'vi'
  ))
}

function buildSystemPrompt(args: BuildEngineCardSpecArgs, primaryStudyLanguage: string | null): string {
  const { definition, studyLanguage, outputLanguage } = args
  const languageProfile = getLanguageProfile(studyLanguage?.code)
  const expert = studyLanguage
    ? languageProfile?.expertLabel
      ?? `${studyLanguage.name} (${studyLanguage.code}) language`
    : `the "${singleLine(definition.name)}" content type`
  const context = definition.description?.trim()
    ? `\nContent type focus: ${singleLine(definition.description)}.`
    : ''
  const profileNotes = languageProfile?.promptNotes ?? (
    primaryStudyLanguage
      ? [
          `Create natural and accurate learning content for ${studyLanguage?.name ?? inferLanguageDisplayName(primaryStudyLanguage)}.`,
          'Keep example sentences short and natural. Return an empty string instead of guessing unknown pronunciation or level information.',
        ]
      : []
  )
  const requirements = profileNotes.length > 0
    ? `\n\nKey requirements:\n${profileNotes.map(note => `- ${note}`).join('\n')}`
    : ''

  return `You are an expert in ${expert}, creating study content for ${outputLanguage.name} speakers.${context}
Generate accurate, concise learning content from the information supplied by the user.
Submit the result only through the "${TOOL_NAME}" tool and follow each field description in the tool schema.
Write definitions, meanings, grammar labels, explanations, and translations in ${outputLanguage.name}.${requirements}`
}

function buildUserMessage(args: BuildEngineCardSpecArgs): string {
  const { definition, primaryValue, formValues, topics } = args
  const primaryLabel = definition.field_labels?.[definition.primary_field_key]
    ?? definition.primary_field_key
  const lines = [`${primaryLabel}: "${primaryValue}"`]

  if (topics && topics.length > 0) {
    lines.push(`Topics: ${topics.join(', ')}`)
  }

  const context = Object.entries(formValues ?? {})
    .filter(([key, value]) => key !== definition.primary_field_key && value.trim())
    .map(([key, value]) => `- ${definition.field_labels?.[key] ?? key}: ${value.trim()}`)
  if (context.length > 0) {
    lines.push('', 'Additional context:', ...context)
  }

  return lines.join('\n')
}

/** Content Type data から schema + prompt + tool contract を一度に構築する pure engine。 */
export function buildEngineCardSpec(args: BuildEngineCardSpecArgs): CardSpec {
  const { definition, studyLanguage, outputLanguage } = args
  const profiles = parseAiOutputProfiles(
    definition.ai_output_profiles,
    definition.primary_field_key,
  )
  const primaryStudyLanguage = studyLanguage
    ? primaryLanguageSubtag(studyLanguage.code)
    : null
  if (studyLanguage && !primaryStudyLanguage) {
    throw new Error(`Invalid BCP 47 study language code: ${studyLanguage.code}`)
  }

  const fields = activeFields(profiles, primaryStudyLanguage, outputLanguage.code)
  if (!fields.some(outputField => outputField.key === definition.primary_field_key)) {
    throw new Error(`Active AI output profile must include primary field "${definition.primary_field_key}"`)
  }

  const schemaShape: Record<string, z.ZodType> = {}
  for (const outputField of fields) {
    const instruction = resolveTemplate(
      outputField.instruction,
      outputLanguage,
      studyLanguage,
      definition.name,
    )
    schemaShape[outputField.key] = outputField.type === 'string_array'
      ? z.array(z.string()).max(outputField.max_items ?? DEFAULT_AI_ARRAY_MAX_ITEMS).describe(instruction)
      : z.string().describe(instruction)
  }

  const schema = z.object(schemaShape) as unknown as z.ZodType<Record<string, unknown>>
  const toolSubject = studyLanguage
    ? `${singleLine(studyLanguage.name)} vocabulary`
    : singleLine(definition.name)
  return {
    toolName: TOOL_NAME,
    toolDescription: `Submit the enriched ${toolSubject} card.`,
    systemPrompt: buildSystemPrompt(args, primaryStudyLanguage),
    userMessage: buildUserMessage(args),
    schema,
    inputSchema: toToolInputSchema(schema),
  }
}
