import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock SDK Anthropic: default export là class có messages.create (createMock).
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock }
  },
}))

import { ClaudeAgentProvider } from '@/lib/ai-agent/claude-agent-provider'
import { resolveBuiltinAiOutputProfiles } from '@/lib/ai-agent/builtinOutputProfiles'
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
const normalizedEnglish = { ...validEnglish, word_type: validEnglish.word_type_vi }

const enInput = { form_type: FormType.LANGUAGE, language: LanguageType.ENGLISH, word: 'resilient' }

function expectCachedSystem(system: unknown, text: string): void {
  expect(system).toEqual([{
    type: 'text',
    text: expect.stringContaining(text),
    cache_control: { type: 'ephemeral' },
  }])
}

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
const normalizedFrench = { ...validFrench, word_type: validFrench.word_type_vi }

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

    expect(result).toEqual(normalizedEnglish)
    expect(createMock).toHaveBeenCalledTimes(1)
    const params = createMock.mock.calls[0][0]
    expect(params.model).toBe('claude-haiku-4-5')
    expect(params.tool_choice).toEqual({ type: 'tool', name: 'submit_card' })
    expect(params.tools[0].name).toBe('submit_card')
    expect(params.tools[0].input_schema.additionalProperties).toBe(false)
    expectCachedSystem(params.system, '英語')
  })

  it('output が無効な場合 retry し、次回成功する', async () => {
    const { ipa, ...invalid } = validEnglish
    void ipa
    createMock
      .mockResolvedValueOnce(toolUseResponse(invalid)) // thiếu field → zod throw
      .mockResolvedValueOnce(toolUseResponse(validEnglish))
    const provider = new ClaudeAgentProvider('claude-haiku-4-5')

    const result = await provider.generateCard(enInput)

    expect(result).toEqual(normalizedEnglish)
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

    expect(result).toEqual(normalizedFrench)
    expectCachedSystem(createMock.mock.calls[0][0].system, 'French')
  })

  it('web_search 経路でも system prompt に cache_control を付与', async () => {
    createMock.mockResolvedValueOnce(toolUseResponse(validEnglish))
    const provider = new ClaudeAgentProvider('claude-haiku-4-5', true)

    expect(await provider.generateCard(enInput)).toEqual(normalizedEnglish)
    const params = createMock.mock.calls[0][0]
    expect(params.tool_choice).toEqual({ type: 'auto' })
    expectCachedSystem(params.system, '英語')
  })

  it('model が submit_card を呼ばない場合 (retry を使い切った後) エラーを throw', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'no tool' }], stop_reason: 'end_turn' })
    const provider = new ClaudeAgentProvider('claude-haiku-4-5')

    await expect(provider.generateCard(enInput)).rejects.toThrow()
    expect(createMock).toHaveBeenCalledTimes(3) // 1 + 2 retries
  })

  it('authoritative built-in definition は engine schema を使い、primary と definition alias を補正する', async () => {
    createMock.mockResolvedValueOnce(toolUseResponse({
      term: 'Model rewrite',
      definition_vi: 'Coordinates asynchronous callbacks',
      definition_short: 'Runtime scheduler',
      example_usage: 'JavaScript uses an event loop.',
      keywords: ['runtime'],
      related_topics: ['JavaScript'],
      analogy_vi: 'A traffic controller',
      unsplash_search_keyword: 'loop',
    }))
    const provider = new ClaudeAgentProvider('claude-haiku-4-5')

    const result = await provider.generateCard({
      form_type: FormType.IT,
      term: 'Event Loop',
      output_language: 'en',
      output_language_name: 'English',
      content_type: {
        name: 'IT Vocabulary',
        primary_field_key: 'term',
        ai_output_profiles: resolveBuiltinAiOutputProfiles(FormType.IT)!,
      },
    })

    expect(result.term).toBe('Event Loop')
    expect(result.definition).toBe('Coordinates asynchronous callbacks')
    expectCachedSystem(createMock.mock.calls[0][0].system, 'IT Vocabulary')
    expect(JSON.stringify(createMock.mock.calls[0][0].tools[0].input_schema)).toContain('English')
  })

  it('authoritative custom definition は configured primary key を input.word から復元する', async () => {
    createMock.mockResolvedValueOnce(toolUseResponse({
      prompt: 'Model rewrite',
      answer: 'The runtime schedules queued work.',
    }))
    const provider = new ClaudeAgentProvider('claude-haiku-4-5')

    const result = await provider.generateCard({
      form_type: 'quiz',
      word: 'Why do event loops matter?',
      dynamicFields: { prompt: 'Why do event loops matter?', audience: 'Beginners' },
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

    expect(result).toEqual({
      prompt: 'Why do event loops matter?',
      answer: 'The runtime schedules queued work.',
    })
    expect(createMock.mock.calls[0][0].messages[0].content).toContain('Audience: Beginners')
  })

  it('web_search の最終提出 instruction も English を使用する', async () => {
    createMock
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'Research complete' }], stop_reason: 'end_turn' })
      .mockResolvedValueOnce(toolUseResponse(validEnglish))
    const provider = new ClaudeAgentProvider('claude-haiku-4-5', true)

    await provider.generateCard(enInput)

    const followUp = createMock.mock.calls[1][0].messages.at(-1)
    expect(followUp).toEqual({
      role: 'user',
      content: 'Call the submit_card tool to submit the final result.',
    })
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
    expectCachedSystem(params.system, 'BCP 47')
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
