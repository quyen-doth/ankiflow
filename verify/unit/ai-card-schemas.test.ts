import { describe, expect, it } from 'vitest'
import {
  englishCardSchema,
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
  it('chấp nhận output đúng schema', () => {
    expect(() => englishCardSchema.parse(validEnglish)).not.toThrow()
  })

  it('từ chối khi thiếu field bắt buộc', () => {
    const { ipa, ...missingIpa } = validEnglish
    void ipa
    expect(() => englishCardSchema.parse(missingIpa)).toThrow()
  })

  it('từ chối khi sai kiểu (collocations không phải mảng)', () => {
    expect(() => englishCardSchema.parse({ ...validEnglish, collocations: 'not-an-array' })).toThrow()
  })

  it('strip field thừa thay vì giữ lại', () => {
    const parsed = englishCardSchema.parse({ ...validEnglish, hacker: 'x' }) as Record<string, unknown>
    expect(parsed).not.toHaveProperty('hacker')
  })
})

describe('ai-agent/card-schemas — toToolInputSchema', () => {
  it('ép additionalProperties=false và required = mọi field', () => {
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
  it('chọn schema Tiếng Anh cho LANGUAGE + en', () => {
    const spec = resolveCardSpec({ form_type: FormType.LANGUAGE, language: LanguageType.ENGLISH, word: 'book' })
    expect(spec.toolName).toBe(TOOL_NAME)
    expect(spec.schema).toBe(englishCardSchema)
    expect(spec.systemPrompt).toContain('Tiếng Anh')
    expect(spec.userMessage).toContain('book')
  })

  it('chọn schema IT và đưa topics vào user message', () => {
    const spec = resolveCardSpec({ form_type: FormType.IT, term: 'Docker', topics: ['DevOps'] })
    expect(spec.schema).toBe(itVocabCardSchema)
    expect(spec.userMessage).toContain('Docker')
    expect(spec.userMessage).toContain('DevOps')
  })

  it('throw với combo không hỗ trợ', () => {
    expect(() => resolveCardSpec({ form_type: FormType.GENERAL })).toThrow('Invalid parameters')
    expect(() => resolveCardSpec({ form_type: FormType.LANGUAGE })).toThrow('Invalid parameters')
  })
})
