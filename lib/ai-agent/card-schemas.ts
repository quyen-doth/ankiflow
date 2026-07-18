import { z } from 'zod'
import { FormType, LanguageType } from '@/types'
import { buildEnglishSystemPrompt, buildEnglishUserMessage } from '@/lib/prompts/english'
import { buildChineseSystemPrompt, buildChineseUserMessage } from '@/lib/prompts/chinese'
import { buildJapaneseSystemPrompt, buildJapaneseUserMessage } from '@/lib/prompts/japanese'
import { buildItVocabSystemPrompt, buildItVocabUserMessage } from '@/lib/prompts/it-vocab'
import { inferLanguageDisplayName, primaryLanguageSubtag } from '@/lib/studyLanguages'
import { buildEngineCardSpec } from './promptEngine'
import type { GenerateCardInput } from './types'

/**
 * カード出力の唯一の source of truth: content-type ごとの zod schema。
 * - `.describe()` を使って各フィールドの指示を model に伝える。
 * - すべてのフィールドが必須 (文字列/配列は空でも可) → tool input_schema がシンプルになり、
 *   旧 prompt のようにモデルがすべてのフィールドを埋める方式と合致する。
 */

export function buildEnglishCardSchema(outputLanguageName: string) {
  return z.object({
    word: z.string().describe('English vocabulary word'),
    ipa: z.string().describe('IPA pronunciation, e.g. /rɪˈzɪl.jənt/'),
    meaning_vi: z.string().describe(`Meaning in ${outputLanguageName}`),
    word_type_vi: z.string().describe(`Part of speech written in ${outputLanguageName}, e.g. "adjective"`),
    example_sentence: z.string().describe('Natural English example sentence under 12 words'),
    example_translation: z.string().describe(`${outputLanguageName} translation of the example sentence`),
    example_blank: z.string().describe('Example sentence with the vocabulary word replaced by "___"'),
    collocations: z.array(z.string()).describe(
      `3-5 common collocations with ${outputLanguageName} meanings in parentheses`,
    ),
    unsplash_search_keyword: z.string().describe('Short English keyword for an illustration image search'),
  })
}

export function buildChineseCardSchema(outputLanguageName: string, includeHanViet: boolean) {
  return z.object({
    word: z.string().describe('Chinese vocabulary word in Han characters'),
    pinyin: z.string().describe('Pinyin pronunciation'),
    ...(includeHanViet ? { han_viet: z.string().describe('Âm Hán Việt của từ') } : {}),
    meaning_vi: z.string().describe(`Meaning in ${outputLanguageName}`),
    word_type: z.string().describe('Part of speech in Chinese, e.g. 名词'),
    word_type_vi: z.string().describe(`Part of speech written in ${outputLanguageName}, e.g. "noun"`),
    level: z.string().describe('HSK level when known, e.g. HSK1; otherwise an empty string'),
    example_sentence: z.string().describe('Natural Chinese example sentence under 10 words'),
    example_translation: z.string().describe(`${outputLanguageName} translation of the example sentence`),
    example_blank: z.string().describe('Example sentence with the vocabulary word replaced by "___"'),
    collocations: z.array(z.string()).describe(
      `3-5 common phrases or measure-word combinations with ${outputLanguageName} meanings`,
    ),
    related_words: z.array(z.string()).describe(`Related words with ${outputLanguageName} meanings`),
    unsplash_search_keyword: z.string().describe('Short English keyword for an illustration image search'),
  })
}

export function buildJapaneseCardSchema(outputLanguageName: string, includeHanViet: boolean) {
  return z.object({
    word: z.string().describe('Japanese vocabulary word'),
    hiragana: z.string().describe('Hiragana reading'),
    katakana: z.string().describe('Katakana for loanwords; otherwise an empty string'),
    romaji: z.string().describe('Latin transliteration in romaji'),
    ...(includeHanViet
      ? { han_viet: z.string().describe('Âm Hán Việt của Kanji trong từ; từ thuần kana để rỗng') }
      : {}),
    meaning_vi: z.string().describe(`Meaning in ${outputLanguageName}`),
    word_type_vi: z.string().describe(`Part of speech written in ${outputLanguageName}`),
    level: z.string().describe('JLPT level when known, e.g. N5; otherwise an empty string'),
    example_sentence: z.string().describe('Natural Japanese example sentence under 10 words'),
    example_translation: z.string().describe(`${outputLanguageName} translation of the example sentence`),
    example_blank: z.string().describe('Example sentence with the vocabulary word replaced by "___"'),
    collocations: z.array(z.string()).describe(
      `3-5 common phrases or particle combinations with ${outputLanguageName} meanings`,
    ),
    related_words: z.array(z.string()).describe(`Related words with ${outputLanguageName} meanings`),
    unsplash_search_keyword: z.string().describe('Short English keyword for an illustration image search'),
  })
}

export function buildGenericLanguageCardSchema(outputLanguageName: string) {
  return z.object({
    word: z.string().describe('Vocabulary word in the target study language'),
    ipa: z.string().describe('IPA pronunciation; return an empty string when unknown'),
    meaning_vi: z.string().describe(`Meaning in ${outputLanguageName}`),
    word_type_vi: z.string().describe(`Part of speech written in ${outputLanguageName}`),
    level: z.string().describe('Common proficiency level when known; otherwise an empty string'),
    example_sentence: z.string().describe('Short example sentence in the target study language'),
    example_translation: z.string().describe(`${outputLanguageName} translation of the example sentence`),
    example_blank: z.string().describe('Example sentence with the vocabulary word replaced by "___"'),
    collocations: z.array(z.string()).describe(
      `3-5 common phrases with ${outputLanguageName} meanings in parentheses`,
    ),
    related_words: z.array(z.string()).describe(`Related words with ${outputLanguageName} meanings`),
    unsplash_search_keyword: z.string().describe('Short English keyword for an illustration image search'),
  })
}

export function buildItVocabCardSchema(outputLanguageName: string) {
  return z.object({
    term: z.string().describe('IT term'),
    definition_vi: z.string().describe(`Clear, complete definition in ${outputLanguageName}`),
    definition_short: z.string().describe('Very short one-sentence definition'),
    example_usage: z.string().describe('Short, realistic usage example'),
    keywords: z.array(z.string()).describe('Related keywords'),
    related_topics: z.array(z.string()).describe('Related topics'),
    analogy_vi: z.string().describe(`Everyday analogy in ${outputLanguageName} to aid memory`),
    unsplash_search_keyword: z.string().describe('Short English keyword for an illustration image search'),
  })
}

export const TOOL_NAME = 'submit_card'

/** 特定の content-type に対して agent を実行するための "spec" を表す。 */
export interface CardSpec {
  toolName: string
  toolDescription: string
  systemPrompt: string
  userMessage: string
  schema: z.ZodType<Record<string, unknown>>
  /** Anthropic tool の `input_schema` 用の JSON Schema。 */
  inputSchema: Record<string, unknown>
}

/**
 * zod schema → Anthropic tool input_schema 用の JSON Schema に変換。
 * 出力を安定させるため `additionalProperties: false` と `required` = 全フィールドを強制。
 */
export function toToolInputSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as { properties?: Record<string, unknown> }
  const properties = json.properties ?? {}
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  }
}

function makeSpec(
  schema: z.ZodType<Record<string, unknown>>,
  systemPrompt: string,
  userMessage: string,
  toolDescription: string,
): CardSpec {
  return {
    toolName: TOOL_NAME,
    toolDescription,
    systemPrompt,
    userMessage,
    schema,
    inputSchema: toToolInputSchema(schema),
  }
}

function withDynamicContext(message: string, fields?: Record<string, string>): string {
  if (!fields) return message
  const context = Object.entries(fields)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => `- ${key}: ${value}`)
    .join('\n')
  return context ? `${message}\n\nAdditional context:\n${context}` : message
}

/**
 * form_type/language に応じて正しい schema + prompt + user message を選択。
 * 英中日は専用 profile、それ以外の有効な BCP 47 言語は汎用 profile を使用。
 */
export function resolveCardSpec(input: GenerateCardInput): CardSpec {
  if (input.content_type) {
    const primaryValue = input.form_type === FormType.IT
      ? input.term
      : input.word
    if (!primaryValue) throw new Error('Invalid parameters for generating content')

    const outputLanguageCode = input.output_language ?? 'vi'
    return buildEngineCardSpec({
      definition: input.content_type,
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

  return resolveLegacyCardSpec(input)
}

/** Legacy requests/documents without output profiles stay on the previous resolver. */
export function resolveLegacyCardSpec(input: GenerateCardInput): CardSpec {
  const outputName = input.output_language_name?.trim() || 'Vietnamese'
  const isVietnamese = (input.output_language ?? 'vi') === 'vi'

  if (input.form_type === FormType.LANGUAGE && input.word && input.language) {
    const languageSubtag = primaryLanguageSubtag(input.language)
    if (!languageSubtag) throw new Error(`Invalid BCP 47 language code: ${input.language}`)

    switch (languageSubtag) {
      case LanguageType.ENGLISH:
        return makeSpec(
          buildEnglishCardSchema(outputName),
          buildEnglishSystemPrompt(outputName),
          withDynamicContext(buildEnglishUserMessage(input.word), input.dynamicFields),
          'Submit the enriched English vocabulary card.',
        )
      case LanguageType.CHINESE:
        return makeSpec(
          buildChineseCardSchema(outputName, isVietnamese),
          buildChineseSystemPrompt(outputName, isVietnamese),
          withDynamicContext(buildChineseUserMessage(input.word), input.dynamicFields),
          'Submit the enriched Chinese vocabulary card.',
        )
      case LanguageType.JAPANESE:
        return makeSpec(
          buildJapaneseCardSchema(outputName, isVietnamese),
          buildJapaneseSystemPrompt(outputName, isVietnamese),
          withDynamicContext(buildJapaneseUserMessage(input.word), input.dynamicFields),
          'Submit the enriched Japanese vocabulary card.',
        )
      default: {
        const languageName = inferLanguageDisplayName(input.language)
        const systemPrompt = `You are an expert vocabulary teacher for ${languageName} (${input.language}).
Create accurate, concise flashcard content for the supplied word.
Write meanings, grammar labels, collocation explanations, related-word explanations, and translations in ${outputName}.
Keep the example sentence natural and short. Use IPA when it is known; otherwise return an empty string.
Return structured data only through the submit_card tool.`
        return makeSpec(
          buildGenericLanguageCardSchema(outputName),
          systemPrompt,
          withDynamicContext(
            `Create a ${languageName} vocabulary flashcard for: "${input.word}"`,
            input.dynamicFields,
          ),
          `Submit an enriched ${languageName} vocabulary flashcard.`,
        )
      }
    }
  }

  if (input.form_type === FormType.IT && input.term) {
    return makeSpec(
      buildItVocabCardSchema(outputName),
      buildItVocabSystemPrompt(outputName),
      withDynamicContext(buildItVocabUserMessage(input.term, input.topics), input.dynamicFields),
      'Submit the enriched IT vocabulary card.',
    )
  }

  if (input.dynamicFields && input.word) {
    return buildDynamicSpec(input.word, input.dynamicFields, outputName, input.contentTypeName)
  }

  throw new Error('Invalid parameters for generating content')
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

/** Restore trusted identity and legacy aliases after validating the model output. */
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

function buildDynamicSpec(
  word: string,
  fields: Record<string, string>,
  outputLanguageName: string,
  contentTypeName?: string,
): CardSpec {
  const schemaShape: Record<string, z.ZodType> = {
    word: z.string().describe('The main term/word'),
    meaning_vi: z.string().describe(`Meaning in ${outputLanguageName}`),
    example_sentence: z.string().describe('Illustrative example sentence'),
    example_translation: z.string().describe(`${outputLanguageName} translation of the example sentence`),
    unsplash_search_keyword: z.string().describe('Short English keyword for an illustration image search'),
  }

  for (const key of Object.keys(fields)) {
    if (!(key in schemaShape)) {
      schemaShape[key] = z.string().describe(`Field: ${key}`)
    }
  }

  const schema = z.object(schemaShape) as unknown as z.ZodType<Record<string, unknown>>

  const typeName = contentTypeName || 'Custom'
  const fieldList = Object.entries(fields)
    .filter(([, v]) => v)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')

  const systemPrompt = `You are an AI assistant that creates enriched flashcard content for "${typeName}" cards.
Given a word/term and optional context, generate comprehensive flashcard content in ${outputLanguageName}.
Always include: meaning in ${outputLanguageName}, example sentence, and ${outputLanguageName} translation of the example.
Return structured data via the submit_card tool.`

  const userMessage = fieldList
    ? `Create a flashcard for: "${word}"\n\nAdditional context:\n${fieldList}`
    : `Create a flashcard for: "${word}"`

  return makeSpec(schema, systemPrompt, userMessage, `Submit enriched ${typeName} flashcard.`)
}
