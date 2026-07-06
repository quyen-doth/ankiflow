import { z } from 'zod'
import { FormType, LanguageType } from '@/types'
import { ENGLISH_SYSTEM_PROMPT, buildEnglishUserMessage } from '@/lib/prompts/english'
import { CHINESE_SYSTEM_PROMPT, buildChineseUserMessage } from '@/lib/prompts/chinese'
import { JAPANESE_SYSTEM_PROMPT, buildJapaneseUserMessage } from '@/lib/prompts/japanese'
import { IT_VOCAB_SYSTEM_PROMPT, buildItVocabUserMessage } from '@/lib/prompts/it-vocab'
import type { GenerateCardInput } from './types'

/**
 * Nguồn sự thật duy nhất cho output thẻ: zod schema cho từng content-type.
 * - Dùng `.describe()` để truyền hướng dẫn từng field cho model.
 * - Mọi field đều bắt buộc (chuỗi/array có thể rỗng) → tool input_schema đơn giản,
 *   hợp với cách model điền đủ field như prompt cũ.
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

/** Mô tả một "spec" để chạy agent cho một content-type cụ thể. */
export interface CardSpec {
  toolName: string
  toolDescription: string
  systemPrompt: string
  userMessage: string
  schema: z.ZodType<Record<string, unknown>>
  /** JSON Schema cho `input_schema` của tool Anthropic. */
  inputSchema: Record<string, unknown>
}

/**
 * Chuyển zod schema → JSON Schema cho tool input_schema của Anthropic.
 * Ép `additionalProperties: false` và `required` = mọi field để output ổn định.
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
 * Chọn schema + prompt + user message đúng theo form_type/language.
 * Throw với combo không hỗ trợ (giữ nguyên hành vi cũ).
 */
export function resolveCardSpec(input: GenerateCardInput): CardSpec {
  if (input.form_type === FormType.LANGUAGE && input.word && input.language) {
    switch (input.language) {
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
      default:
        throw new Error(`Unsupported language: ${input.language}`)
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
