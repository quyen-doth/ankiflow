import Anthropic from '@anthropic-ai/sdk'
import { resolveCardSpec, type CardSpec } from './card-schemas'
import type { GenerateCardInput, IAIAgentProvider } from './types'

// Lazy singleton client — tránh khởi tạo lúc import (an toàn cho test/build khi thiếu key).
let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('Missing ANTHROPIC_API_KEY in environment variables')
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

const MAX_TOKENS = 4096
const TEMPERATURE = 0.3
const MAX_SEARCH_TURNS = 6

/**
 * Provider sinh nội dung thẻ bằng Claude theo kiểu "công cụ hóa":
 * model bị ép gọi tool `submit_card` (schema thẻ) để trả structured output.
 * Vòng lặp do code điều phối (workflow), không phải autonomous loop.
 */
export class ClaudeAgentProvider implements IAIAgentProvider {
  constructor(
    private readonly model: string,
    private readonly webSearchEnabled = false,
  ) {}

  async generateCard(input: GenerateCardInput, retries = 2): Promise<Record<string, unknown>> {
    const spec = resolveCardSpec(input)
    try {
      const raw = this.webSearchEnabled
        ? await this.runWithSearch(spec)
        : await this.runForced(spec)
      // Validate output đúng schema (điều mà bản Gemini cũ thiếu).
      return spec.schema.parse(raw) as Record<string, unknown>
    } catch (error) {
      if (retries > 0) {
        console.warn(`Claude generation failed, retrying... (${retries} left)`)
        return this.generateCard(input, retries - 1)
      }
      throw error
    }
  }

  /** Đường mặc định: 1 call, ép gọi đúng tool `submit_card`. Deterministic, rẻ. */
  private async runForced(spec: CardSpec): Promise<unknown> {
    const cardTool: Anthropic.Tool = {
      name: spec.toolName,
      description: spec.toolDescription,
      input_schema: spec.inputSchema as Anthropic.Tool.InputSchema,
    }

    const res = await getClient().messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: spec.systemPrompt,
      tools: [cardTool],
      tool_choice: { type: 'tool', name: spec.toolName },
      messages: [{ role: 'user', content: spec.userMessage }],
    })

    return extractToolInput(res, spec.toolName)
  }

  /**
   * Đường tùy chọn (settings.web_search_enabled): agent có thêm tool web_search
   * để kiểm chứng nghĩa/cách dùng, rồi nộp qua `submit_card`. Code làm chủ vòng lặp.
   */
  private async runWithSearch(spec: CardSpec): Promise<unknown> {
    const cardTool: Anthropic.Tool = {
      name: spec.toolName,
      description: spec.toolDescription,
      input_schema: spec.inputSchema as Anthropic.Tool.InputSchema,
    }
    // web_search là server-side tool; cast lỏng để không phụ thuộc version SDK.
    const webSearchTool = {
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 3,
    } as unknown as Anthropic.ToolUnion

    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: spec.userMessage }]

    for (let turn = 0; turn < MAX_SEARCH_TURNS; turn++) {
      const res = await getClient().messages.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: spec.systemPrompt,
        tools: [cardTool, webSearchTool],
        tool_choice: { type: 'auto' },
        messages,
      })

      const submit = res.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === spec.toolName,
      )
      if (submit) return submit.input

      // Server tool (web_search) chạm giới hạn vòng → resend để model tiếp tục.
      if ((res.stop_reason as string) === 'pause_turn') {
        messages.push({ role: 'assistant', content: res.content })
        continue
      }

      // Model dừng mà chưa nộp → nhắc nộp rồi thử tiếp.
      messages.push({ role: 'assistant', content: res.content })
      messages.push({ role: 'user', content: `Hãy gọi tool ${spec.toolName} để nộp kết quả cuối cùng.` })
    }

    throw new Error('Model did not submit card after web_search loop')
  }
}

function extractToolInput(res: Anthropic.Message, toolName: string): unknown {
  const block = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === toolName,
  )
  if (!block) {
    throw new Error('Model did not return the submit_card tool call')
  }
  return block.input
}
