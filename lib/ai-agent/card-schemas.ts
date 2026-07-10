import { z } from 'zod'
import { FormType, LanguageType } from '@/types'
import { ENGLISH_SYSTEM_PROMPT, buildEnglishUserMessage } from '@/lib/prompts/english'
import { CHINESE_SYSTEM_PROMPT, buildChineseUserMessage } from '@/lib/prompts/chinese'
import { JAPANESE_SYSTEM_PROMPT, buildJapaneseUserMessage } from '@/lib/prompts/japanese'
import { IT_VOCAB_SYSTEM_PROMPT, buildItVocabUserMessage } from '@/lib/prompts/it-vocab'
import { inferLanguageDisplayName, primaryLanguageSubtag } from '@/lib/studyLanguages'
import type { GenerateCardInput } from './types'

/**
 * カード出力の唯一の source of truth: content-type ごとの zod schema。
 * - `.describe()` を使って各フィールドの指示を model に伝える。
 * - すべてのフィールドが必須 (文字列/配列は空でも可) → tool input_schema がシンプルになり、
 *   旧 prompt のようにモデルがすべてのフィールドを埋める方式と合致する。
 */

export const englishCardSchema = z.object({
  word: z.string().describe('Từ vựng tiếng Anh'),
  ipa: z.string().describe('Phiên âm IPA, vd /rɪˈzɪl.jənt/'),
  meaning_vi: z.string().describe('Nghĩa tiếng Việt'),
  word_type_vi: z.string().describe('Loại từ bằng tiếng Việt, vd "tính từ"'),
  example_sentence: z.string().describe('Câu ví dụ tiếng Anh, dưới 12 từ'),
  example_translation: z.string().describe('Bản dịch tiếng Việt của câu ví dụ'),
  example_blank: z.string().describe('Câu ví dụ với từ vựng cần học thay bằng "___"'),
  collocations: z.array(z.string()).describe('3-5 collocation kèm nghĩa TV, vd "book a flight (đặt vé máy bay)"'),
  unsplash_search_keyword: z.string().describe('Từ khóa tiếng Anh để tìm ảnh minh họa'),
})

export const chineseCardSchema = z.object({
  word: z.string().describe('Từ vựng tiếng Trung (Hán tự)'),
  pinyin: z.string().describe('Phiên âm pinyin'),
  han_viet: z.string().describe('Âm Hán Việt'),
  meaning_vi: z.string().describe('Nghĩa tiếng Việt'),
  word_type: z.string().describe('Loại từ bằng tiếng Trung, vd 名词'),
  word_type_vi: z.string().describe('Loại từ bằng tiếng Việt, vd "danh từ"'),
  level: z.string().describe('Cấp độ HSK nếu xác định được, vd HSK1'),
  example_sentence: z.string().describe('Câu ví dụ tiếng Trung, dưới 10 từ'),
  example_translation: z.string().describe('Bản dịch tiếng Việt của câu ví dụ'),
  example_blank: z.string().describe('Câu ví dụ với từ cần học thay bằng "___"'),
  collocations: z.array(z.string()).describe('3-5 cụm từ/lượng từ kèm nghĩa TV'),
  related_words: z.array(z.string()).describe('Các từ liên quan'),
  unsplash_search_keyword: z.string().describe('Từ khóa tiếng Anh để tìm ảnh minh họa'),
})

export const japaneseCardSchema = z.object({
  word: z.string().describe('Từ vựng tiếng Nhật'),
  hiragana: z.string().describe('Cách đọc hiragana'),
  katakana: z.string().describe('Katakana nếu là từ ngoại lai, nếu không để rỗng'),
  romaji: z.string().describe('Chuyển tự La-tinh (romaji)'),
  han_viet: z.string().describe('Âm Hán Việt của Kanji trong từ, để rỗng nếu từ thuần kana'),
  meaning_vi: z.string().describe('Nghĩa tiếng Việt'),
  word_type_vi: z.string().describe('Loại từ bằng tiếng Việt'),
  level: z.string().describe('Cấp độ JLPT nếu xác định được, vd N5'),
  example_sentence: z.string().describe('Câu ví dụ tiếng Nhật, dưới 10 từ'),
  example_translation: z.string().describe('Bản dịch tiếng Việt của câu ví dụ'),
  example_blank: z.string().describe('Câu ví dụ với từ cần học thay bằng "___"'),
  collocations: z.array(z.string()).describe('3-5 cụm từ/trợ từ kèm nghĩa TV'),
  related_words: z.array(z.string()).describe('Các từ liên quan'),
  unsplash_search_keyword: z.string().describe('Từ khóa tiếng Anh để tìm ảnh minh họa'),
})

export const genericLanguageCardSchema = z.object({
  word: z.string().describe('Từ vựng trong ngôn ngữ đích'),
  ipa: z.string().describe('Phiên âm IPA; để rỗng nếu không xác định được'),
  meaning_vi: z.string().describe('Nghĩa tiếng Việt'),
  word_type_vi: z.string().describe('Loại từ bằng tiếng Việt'),
  level: z.string().describe('Cấp độ thông dụng nếu xác định được; nếu không để rỗng'),
  example_sentence: z.string().describe('Câu ví dụ ngắn trong ngôn ngữ đích'),
  example_translation: z.string().describe('Bản dịch tiếng Việt của câu ví dụ'),
  example_blank: z.string().describe('Câu ví dụ với từ cần học thay bằng "___"'),
  collocations: z.array(z.string()).describe('3-5 cụm từ thường gặp kèm nghĩa tiếng Việt'),
  related_words: z.array(z.string()).describe('Các từ liên quan kèm nghĩa tiếng Việt'),
  unsplash_search_keyword: z.string().describe('Từ khóa tiếng Anh để tìm ảnh minh họa'),
})

export const itVocabCardSchema = z.object({
  term: z.string().describe('Thuật ngữ IT'),
  definition_vi: z.string().describe('Định nghĩa tiếng Việt đầy đủ nhưng rõ ràng'),
  definition_short: z.string().describe('Định nghĩa 1 câu siêu ngắn gọn'),
  example_usage: z.string().describe('Ví dụ sử dụng thực tế, ngắn gọn'),
  keywords: z.array(z.string()).describe('Các từ khóa liên quan'),
  related_topics: z.array(z.string()).describe('Các chủ đề liên quan'),
  analogy_vi: z.string().describe('Ví von đời thường giúp dễ nhớ'),
  unsplash_search_keyword: z.string().describe('Từ khóa tiếng Anh để tìm ảnh minh họa'),
})

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

/**
 * form_type/language に応じて正しい schema + prompt + user message を選択。
 * 英中日は専用 profile、それ以外の有効な BCP 47 言語は汎用 profile を使用。
 */
export function resolveCardSpec(input: GenerateCardInput): CardSpec {
  if (input.form_type === FormType.LANGUAGE && input.word && input.language) {
    const languageSubtag = primaryLanguageSubtag(input.language)
    if (!languageSubtag) throw new Error(`Invalid BCP 47 language code: ${input.language}`)

    switch (languageSubtag) {
      case LanguageType.ENGLISH:
        return makeSpec(
          englishCardSchema,
          ENGLISH_SYSTEM_PROMPT,
          buildEnglishUserMessage(input.word),
          'Nộp thẻ từ vựng Tiếng Anh đã được enrich.',
        )
      case LanguageType.CHINESE:
        return makeSpec(
          chineseCardSchema,
          CHINESE_SYSTEM_PROMPT,
          buildChineseUserMessage(input.word),
          'Nộp thẻ từ vựng Tiếng Trung đã được enrich.',
        )
      case LanguageType.JAPANESE:
        return makeSpec(
          japaneseCardSchema,
          JAPANESE_SYSTEM_PROMPT,
          buildJapaneseUserMessage(input.word),
          'Nộp thẻ từ vựng Tiếng Nhật đã được enrich.',
        )
      default: {
        const languageName = inferLanguageDisplayName(input.language)
        const systemPrompt = `You are an expert vocabulary teacher for ${languageName} (${input.language}).
Create accurate, concise flashcard content for the supplied word.
Write meanings, grammar labels, collocation explanations, related-word explanations, and translations in Vietnamese.
Keep the example sentence natural and short. Use IPA when it is known; otherwise return an empty string.
Return structured data only through the submit_card tool.`
        return makeSpec(
          genericLanguageCardSchema,
          systemPrompt,
          `Create a ${languageName} vocabulary flashcard for: "${input.word}"`,
          `Submit an enriched ${languageName} vocabulary flashcard.`,
        )
      }
    }
  }

  if (input.form_type === FormType.IT && input.term) {
    return makeSpec(
      itVocabCardSchema,
      IT_VOCAB_SYSTEM_PROMPT,
      buildItVocabUserMessage(input.term, input.topics),
      'Nộp thẻ thuật ngữ IT đã được enrich.',
    )
  }

  if (input.dynamicFields && input.word) {
    return buildDynamicSpec(input.word, input.dynamicFields, input.contentTypeName)
  }

  throw new Error('Invalid parameters for generating content')
}

function buildDynamicSpec(
  word: string,
  fields: Record<string, string>,
  contentTypeName?: string,
): CardSpec {
  const schemaShape: Record<string, z.ZodType> = {
    word: z.string().describe('The main term/word'),
    meaning_vi: z.string().describe('Nghĩa tiếng Việt'),
    example_sentence: z.string().describe('Câu ví dụ minh họa'),
    example_translation: z.string().describe('Bản dịch câu ví dụ sang tiếng Việt'),
    unsplash_search_keyword: z.string().describe('Từ khóa tiếng Anh để tìm ảnh minh họa'),
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
Given a word/term and optional context, generate comprehensive flashcard content in Vietnamese.
Always include: meaning in Vietnamese, example sentence, and Vietnamese translation of the example.
Return structured data via the submit_card tool.`

  const userMessage = fieldList
    ? `Create a flashcard for: "${word}"\n\nAdditional context:\n${fieldList}`
    : `Create a flashcard for: "${word}"`

  return makeSpec(schema, systemPrompt, userMessage, `Submit enriched ${typeName} flashcard.`)
}
