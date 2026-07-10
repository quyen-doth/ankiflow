import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock SDK Anthropic: default export là class có messages.create (createMock).
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock }
  },
}))

import { ClaudeAgentProvider } from '@/lib/ai-agent/claude-agent-provider'
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

const enInput = { form_type: FormType.LANGUAGE, language: LanguageType.ENGLISH, word: 'resilient' }

const validFrench = {
  word: 'bonjour',
  ipa: '/bɔ̃.ʒuʁ/',
  meaning_vi: 'xin chào',
  word_type_vi: 'thán từ',
  level: 'A1',
  example_sentence: 'Bonjour, comment allez-vous ?',
  example_translation: 'Xin chào, bạn khỏe không?',
  example_blank: '___, comment allez-vous ?',
  collocations: ['dire bonjour (nói xin chào)'],
  related_words: ['salut (chào)'],
  unsplash_search_keyword: 'greeting',
}

function toolUseResponse(input: unknown) {
  return { content: [{ type: 'tool_use', name: 'submit_card', input }], stop_reason: 'tool_use' }
}

function detectionToolResponse(input: unknown) {
  return { content: [{ type: 'tool_use', name: 'submit_language_detection', input }], stop_reason: 'tool_use' }
}

beforeEach(() => {
  createMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ClaudeAgentProvider — forced submit_card', () => {
  it('tool submit_card の呼び出しを強制し、正しい model で validate 済み output を返す', async () => {
    createMock.mockResolvedValueOnce(toolUseResponse(validEnglish))
    const provider = new ClaudeAgentProvider('claude-haiku-4-5')

    const result = await provider.generateCard(enInput)

    expect(result).toEqual(validEnglish)
    expect(createMock).toHaveBeenCalledTimes(1)
    const params = createMock.mock.calls[0][0]
    expect(params.model).toBe('claude-haiku-4-5')
    expect(params.tool_choice).toEqual({ type: 'tool', name: 'submit_card' })
    expect(params.tools[0].name).toBe('submit_card')
    expect(params.tools[0].input_schema.additionalProperties).toBe(false)
  })

  it('output が無効な場合 retry し、次回成功する', async () => {
    const { ipa, ...invalid } = validEnglish
    void ipa
    createMock
      .mockResolvedValueOnce(toolUseResponse(invalid)) // thiếu field → zod throw
      .mockResolvedValueOnce(toolUseResponse(validEnglish))
    const provider = new ClaudeAgentProvider('claude-haiku-4-5')

    const result = await provider.generateCard(enInput)

    expect(result).toEqual(validEnglish)
    expect(createMock).toHaveBeenCalledTimes(2)
  })

  it('任意の BCP 47 言語でも汎用 schema を validate して返す', async () => {
    createMock.mockResolvedValueOnce(toolUseResponse(validFrench))
    const provider = new ClaudeAgentProvider('claude-haiku-4-5')

    const result = await provider.generateCard({
      form_type: FormType.LANGUAGE,
      language: 'fr-FR',
      word: 'bonjour',
    })

    expect(result).toEqual(validFrench)
    expect(createMock.mock.calls[0][0].system).toContain('French')
  })

  it('model が submit_card を呼ばない場合 (retry を使い切った後) エラーを throw', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'no tool' }], stop_reason: 'end_turn' })
    const provider = new ClaudeAgentProvider('claude-haiku-4-5')

    await expect(provider.generateCard(enInput)).rejects.toThrow()
    expect(createMock).toHaveBeenCalledTimes(3) // 1 + 2 retries
  })
})

describe('ClaudeAgentProvider — language detection', () => {
  it('forces structured detection, canonicalizes BCP 47, and keeps configured labels', async () => {
    createMock.mockResolvedValueOnce(detectionToolResponse({
      detections: [{ index: 0, code: 'pt_br', display_name: 'Portuguese', confidence: 0.92 }],
    }))
    const provider = new ClaudeAgentProvider('claude-haiku-4-5')

    const result = await provider.detectLanguages({
      items: ['olá'],
      candidateLanguages: [{ code: 'pt-BR', display_name: 'Português' }],
    })

    expect(result).toEqual([
      { index: 0, code: 'pt-BR', display_name: 'Português', confidence: 0.92 },
    ])
    const params = createMock.mock.calls[0][0]
    expect(params.tool_choice).toEqual({ type: 'tool', name: 'submit_language_detection' })
    expect(params.system).toContain('BCP 47')
  })

  it('retries incomplete index sets and then succeeds', async () => {
    createMock
      .mockResolvedValueOnce(detectionToolResponse({ detections: [] }))
      .mockResolvedValueOnce(detectionToolResponse({
        detections: [{ index: 0, code: 'ko', display_name: 'Korean', confidence: 0.95 }],
      }))
    const provider = new ClaudeAgentProvider('claude-haiku-4-5')

    const result = await provider.detectLanguages({ items: ['안녕'], candidateLanguages: [] })

    expect(result[0].code).toBe('ko')
    expect(createMock).toHaveBeenCalledTimes(2)
  })
})
