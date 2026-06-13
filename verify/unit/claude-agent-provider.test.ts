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

function toolUseResponse(input: unknown) {
  return { content: [{ type: 'tool_use', name: 'submit_card', input }], stop_reason: 'tool_use' }
}

beforeEach(() => {
  createMock.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ClaudeAgentProvider — forced submit_card', () => {
  it('ép gọi tool submit_card với đúng model và trả output đã validate', async () => {
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

  it('retry khi output không hợp lệ rồi thành công ở lần sau', async () => {
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

  it('ném lỗi (sau khi cạn retry) khi model không gọi submit_card', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'no tool' }], stop_reason: 'end_turn' })
    const provider = new ClaudeAgentProvider('claude-haiku-4-5')

    await expect(provider.generateCard(enInput)).rejects.toThrow()
    expect(createMock).toHaveBeenCalledTimes(3) // 1 + 2 retries
  })
})
