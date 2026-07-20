import { describe, expect, it } from 'vitest'
import {
  normalizeGeneratedCard,
  resolveCardSpec,
  toToolInputSchema,
  TOOL_NAME,
} from '@/lib/ai-agent/card-schemas'
import { resolveBuiltinAiOutputProfiles } from '@/lib/ai-agent/builtinOutputProfiles'
import { FormType, LanguageType } from '@/types'

const validEnglish = {
  word: 'resilient',
  ipa: '/rɪˈzɪljənt/',
  meaning_vi: '粘り強い',
  word_type_vi: '形容詞',
  example_sentence: 'She stayed resilient under pressure.',
  example_translation: '彼女はプレッシャーの中でも粘り強かった。',
  example_blank: 'She stayed ___ under pressure.',
  collocations: ['highly resilient (rất 粘り強い)'],
  unsplash_search_keyword: 'resilience',
}

const englishCardSchema = resolveCardSpec({
  form_type: FormType.LANGUAGE,
  language: LanguageType.ENGLISH,
  word: 'resilient',
}).schema

describe('ai-agent/card-schemas — zod validation', () => {
  it('正しいスキーマの output を受け入れる', () => {
    expect(() => englishCardSchema.parse(validEnglish)).not.toThrow()
  })

  it('必須 field が不足している場合は拒否', () => {
    const { ipa, ...missingIpa } = validEnglish
    void ipa
    expect(() => englishCardSchema.parse(missingIpa)).toThrow()
  })

  it('型が誤っている場合は拒否 (collocations が配列でない)', () => {
    expect(() => englishCardSchema.parse({ ...validEnglish, collocations: 'not-an-array' })).toThrow()
  })

  it('余分な field は保持せず strip する', () => {
    const parsed = englishCardSchema.parse({ ...validEnglish, hacker: 'x' }) as Record<string, unknown>
    expect(parsed).not.toHaveProperty('hacker')
  })
})

describe('ai-agent/card-schemas — toToolInputSchema', () => {
  it('additionalProperties=false と required = 全フィールドを強制', () => {
    const json = toToolInputSchema(englishCardSchema) as {
      type: string
      properties: Record<string, unknown>
      required: string[]
      additionalProperties: boolean
    }
    expect(json.type).toBe('object')
    expect(json.additionalProperties).toBe(false)
    expect(json.properties).toHaveProperty('word')
    expect(json.properties).toHaveProperty('collocations')
    expect(json.required.sort()).toEqual(Object.keys(json.properties).sort())
  })
})

describe('ai-agent/card-schemas — resolveCardSpec', () => {
  it('LANGUAGE + en に対して英語スキーマを選択', () => {
    const spec = resolveCardSpec({ form_type: FormType.LANGUAGE, language: LanguageType.ENGLISH, word: 'book' })
    expect(spec.toolName).toBe(TOOL_NAME)
    expect(spec.inputSchema).toHaveProperty('properties.ipa')
    expect(spec.systemPrompt).toContain('English language')
    expect(spec.userMessage).toContain('book')
  })

  it('英語 variant に対して専用スキーマを選択', () => {
    const spec = resolveCardSpec({ form_type: FormType.LANGUAGE, language: 'en-GB', word: 'lift' })
    expect(spec.inputSchema).toHaveProperty('properties.ipa')
    expect(spec.systemPrompt).toContain('English language')
  })

  it('任意の BCP 47 言語に対して汎用スキーマを選択', () => {
    const spec = resolveCardSpec({ form_type: FormType.LANGUAGE, language: 'fr-FR', word: 'bonjour' })
    expect(spec.inputSchema).toHaveProperty('properties.ipa')
    expect(spec.systemPrompt).toContain('French')
    expect(spec.userMessage).toContain('bonjour')
  })

  it('無効な language code を汎用 profile に通さない', () => {
    expect(() => resolveCardSpec({
      form_type: FormType.LANGUAGE,
      language: 'not a language',
      word: 'hello',
    })).toThrow('Invalid BCP 47 study language code')
  })

  it('IT スキーマを選択し、topics を user message に含める', () => {
    const spec = resolveCardSpec({ form_type: FormType.IT, term: 'Docker', topics: ['DevOps'] })
    expect(spec.inputSchema).toHaveProperty('properties.definition_vi')
    expect(spec.userMessage).toContain('Docker')
    expect(spec.userMessage).toContain('DevOps')
  })

  it('サポートされていない組み合わせで throw', () => {
    expect(() => resolveCardSpec({ form_type: FormType.GENERAL })).toThrow('Invalid parameters')
    expect(() => resolveCardSpec({ form_type: FormType.LANGUAGE })).toThrow('Invalid parameters')
  })

  it('authoritative definition がある場合は英語 prompt engine を使用する', () => {
    const spec = resolveCardSpec({
      form_type: FormType.LANGUAGE,
      language: LanguageType.ENGLISH,
      language_name: 'English',
      word: 'book',
      content_type: {
        name: 'Language',
        description: 'Vocabulary learning',
        primary_field_key: 'word',
        ai_output_profiles: resolveBuiltinAiOutputProfiles(FormType.LANGUAGE)!,
        field_labels: { word: 'Vocabulary item', note: 'Context note' },
      },
      dynamicFields: { note: 'Printed object' },
    })

    expect(spec.systemPrompt).toContain('You are an expert in English language')
    expect(spec.systemPrompt).not.toMatch(/[ぁ-んァ-ヶ]/)
    expect(spec.userMessage).toContain('Vocabulary item: "book"')
    expect(spec.userMessage).toContain('Context note: Printed object')
  })

  it('custom definition は configured primary と output fields を使用する', () => {
    const spec = resolveCardSpec({
      form_type: 'quiz',
      word: 'Why do event loops matter?',
      output_language: 'en',
      output_language_name: 'English',
      dynamicFields: {
        prompt: 'Why do event loops matter?',
        audience: 'Beginners',
      },
      content_type: {
        name: 'Quiz',
        primary_field_key: 'prompt',
        ai_output_profiles: [{
          profile: 'default',
          fields: [
            { key: 'prompt', type: 'string', instruction: 'Original question' },
            { key: 'answer', type: 'string', instruction: 'Answer in {output_language}' },
          ],
        }],
        field_labels: { prompt: 'Question', audience: 'Audience' },
      },
    })

    expect(spec.inputSchema).toHaveProperty('properties.prompt')
    expect(spec.inputSchema).toHaveProperty('properties.answer')
    expect(spec.inputSchema).not.toHaveProperty('properties.word')
    expect(spec.userMessage).toContain('Question: "Why do event loops matter?"')
    expect(spec.userMessage).toContain('Audience: Beginners')
    expect(JSON.stringify(spec.inputSchema)).toContain('English')
  })

  it('definition がない旧 request も data-driven engine fallback を使用する', () => {
    const resolved = resolveCardSpec({
      form_type: FormType.LANGUAGE,
      language: LanguageType.ENGLISH,
      word: 'book',
    })
    expect(resolved.systemPrompt).toContain('You are an expert in English language')
    expect(resolved.systemPrompt).not.toMatch(/[ぁ-んァ-ヶ]/)
    expect(resolved.inputSchema).toHaveProperty('properties.word')
    expect(resolved.inputSchema).toHaveProperty('properties.ipa')
  })

  it('旧 custom request は safe dynamic fields を generic engine profile に含める', () => {
    const resolved = resolveCardSpec({
      form_type: 'science_note',
      word: 'Photosynthesis',
      contentTypeName: 'Science Note',
      dynamicFields: {
        context: 'Plant biology',
        status: 'must not become generated metadata',
      },
    })

    expect(resolved.systemPrompt).toContain('the "Science Note" content type')
    expect(resolved.inputSchema).toHaveProperty('properties.context')
    expect(resolved.inputSchema).not.toHaveProperty('properties.status')
  })
})

describe('ai-agent/card-schemas — normalizeGeneratedCard', () => {
  it('AI の primary を input で上書きし、legacy aliases を補う', () => {
    const normalized = normalizeGeneratedCard({
      form_type: FormType.IT,
      term: 'Event Loop',
    }, {
      term: 'Wrong identity',
      definition_vi: 'Coordinates asynchronous callbacks',
    })

    expect(normalized).toMatchObject({
      term: 'Event Loop',
      definition_vi: 'Coordinates asynchronous callbacks',
      definition: 'Coordinates asynchronous callbacks',
    })
  })

  it('custom primary key を input.word から復元し、既存 alias target を保持する', () => {
    const normalized = normalizeGeneratedCard({
      form_type: 'quiz',
      word: 'Trusted question',
      content_type: {
        name: 'Quiz',
        primary_field_key: 'prompt',
        ai_output_profiles: [{
          profile: 'default',
          fields: [{ key: 'prompt', type: 'string', instruction: 'Question' }],
        }],
      },
    }, {
      prompt: 'Model rewrite',
      word_type: '名词',
      word_type_vi: 'noun',
    })

    expect(normalized.prompt).toBe('Trusted question')
    expect(normalized.word_type).toBe('名词')
  })
})
