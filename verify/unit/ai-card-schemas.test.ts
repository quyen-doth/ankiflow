import { describe, expect, it } from 'vitest'
import {
  englishCardSchema,
  genericLanguageCardSchema,
  itVocabCardSchema,
  resolveCardSpec,
  toToolInputSchema,
  TOOL_NAME,
} from '@/lib/ai-agent/card-schemas'
import { FormType, LanguageType } from '@/types'

const validEnglish = {
  word: 'resilient',
  ipa: '/rɪˈzɪljənt/',
  meaning_vi: 'kiên cường',
  word_type_vi: 'tính từ',
  example_sentence: 'She stayed resilient under pressure.',
  example_translation: 'Cô ấy vẫn kiên cường dưới áp lực.',
  example_blank: 'She stayed ___ under pressure.',
  collocations: ['highly resilient (rất kiên cường)'],
  unsplash_search_keyword: 'resilience',
}

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
    expect(spec.schema).toBe(englishCardSchema)
    expect(spec.systemPrompt).toContain('英語')
    expect(spec.userMessage).toContain('book')
  })

  it('英語 variant に対して専用スキーマを選択', () => {
    const spec = resolveCardSpec({ form_type: FormType.LANGUAGE, language: 'en-GB', word: 'lift' })
    expect(spec.schema).toBe(englishCardSchema)
  })

  it('任意の BCP 47 言語に対して汎用スキーマを選択', () => {
    const spec = resolveCardSpec({ form_type: FormType.LANGUAGE, language: 'fr-FR', word: 'bonjour' })
    expect(spec.schema).toBe(genericLanguageCardSchema)
    expect(spec.systemPrompt).toContain('French')
    expect(spec.userMessage).toContain('bonjour')
  })

  it('無効な language code を汎用 profile に通さない', () => {
    expect(() => resolveCardSpec({
      form_type: FormType.LANGUAGE,
      language: 'not a language',
      word: 'hello',
    })).toThrow('Invalid BCP 47 language code')
  })

  it('IT スキーマを選択し、topics を user message に含める', () => {
    const spec = resolveCardSpec({ form_type: FormType.IT, term: 'Docker', topics: ['DevOps'] })
    expect(spec.schema).toBe(itVocabCardSchema)
    expect(spec.userMessage).toContain('Docker')
    expect(spec.userMessage).toContain('DevOps')
  })

  it('サポートされていない組み合わせで throw', () => {
    expect(() => resolveCardSpec({ form_type: FormType.GENERAL })).toThrow('Invalid parameters')
    expect(() => resolveCardSpec({ form_type: FormType.LANGUAGE })).toThrow('Invalid parameters')
  })
})
