import Anthropic from '@anthropic-ai/sdk'
import { normalizeGeneratedCard, resolveCardSpec } from './card-schemas'
import type { CardSpec } from './card-spec'
import { buildLanguageDetectionSpec, languageDetectionResultSchema } from './language-detection'
import {
  buildInstructionSuggestionSpec,
  instructionSuggestionResultSchema,
} from './instructionSuggestion'
import { canonicalizeLanguageCode, inferLanguageDisplayName } from '@/lib/studyLanguages'
import type {
  DetectLanguagesInput,
  GenerateCardInput,
  IAIAgentProvider,
  LanguageDetection,
  SuggestInstructionInput,
} from './types'

// Lazy singleton client — import 時の初期化を回避 (key がない場合の test/build でも安全)。
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

function cacheableSystemPrompt(text: string): Anthropic.TextBlockParam[] {
  return [{
    type: 'text',
    text,
    // tools → system の prefix を 5 分間 cache。閾値未満の prompt では安全な no-op。
    cache_control: { type: 'ephemeral' },
  }]
}

/**
 * "tool 化" 方式で Claude によりカードコンテンツを生成する Provider:
 * model は tool `submit_card` (カードスキーマ) の呼び出しを強制され、structured output を返す。
 * ループは code が制御する (workflow) — autonomous loop ではない。
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
      // 出力が正しいスキーマか validate (旧 provider は validate していなかった)。
      const parsed = spec.schema.parse(raw) as Record<string, unknown>
      return normalizeGeneratedCard(input, parsed)
    } catch (error) {
      if (retries > 0) {
        console.warn(`Claude generation failed, retrying... (${retries} left)`)
        return this.generateCard(input, retries - 1)
      }
      throw error
    }
  }

  async detectLanguages(input: DetectLanguagesInput, retries = 2): Promise<LanguageDetection[]> {
    const spec = buildLanguageDetectionSpec(input)
    try {
      const raw = await this.runForced(spec)
      const parsed = languageDetectionResultSchema.parse(raw)
      if (parsed.detections.length !== input.items.length) {
        throw new Error('Language detector returned an incomplete result')
      }

      const byIndex = new Map(parsed.detections.map(detection => [detection.index, detection]))
      if (byIndex.size !== input.items.length) {
        throw new Error('Language detector returned duplicate indexes')
      }

      return input.items.map((_, index) => {
        const detection = byIndex.get(index)
        if (!detection) throw new Error(`Language detector omitted item ${index}`)
        const code = canonicalizeLanguageCode(detection.code)
        if (!code) throw new Error(`Language detector returned invalid BCP 47 code: ${detection.code}`)
        const configured = input.candidateLanguages.find(candidate => (
          canonicalizeLanguageCode(candidate.code) === code
        ))
        return {
          index,
          code,
          display_name: configured?.display_name ?? inferLanguageDisplayName(code),
          confidence: detection.confidence,
        }
      })
    } catch (error) {
      if (retries > 0) {
        console.warn(`Claude language detection failed, retrying... (${retries} left)`)
        return this.detectLanguages(input, retries - 1)
      }
      throw error
    }
  }

  async suggestInstruction(input: SuggestInstructionInput, retries = 2): Promise<string> {
    const spec = buildInstructionSuggestionSpec(input)
    try {
      const raw = await this.runForced(spec)
      return instructionSuggestionResultSchema.parse(raw).instruction
    } catch (error) {
      if (retries > 0) {
        console.warn(`Instruction suggestion failed, retrying... (${retries} left)`)
        return this.suggestInstruction(input, retries - 1)
      }
      throw error
    }
  }

  /** デフォルトの経路: 1 回の call、tool `submit_card` の呼び出しを強制。Deterministic、低コスト。 */
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
      system: cacheableSystemPrompt(spec.systemPrompt),
      tools: [cardTool],
      tool_choice: { type: 'tool', name: spec.toolName },
      messages: [{ role: 'user', content: spec.userMessage }],
    })

    return extractToolInput(res, spec.toolName)
  }

  /**
   * オプションの経路 (settings.web_search_enabled): agent は web_search tool を追加で持ち、
   * 意味/使い方を検証してから `submit_card` で提出する。code がループを制御する。
   */
  private async runWithSearch(spec: CardSpec): Promise<unknown> {
    const cardTool: Anthropic.Tool = {
      name: spec.toolName,
      description: spec.toolDescription,
      input_schema: spec.inputSchema as Anthropic.Tool.InputSchema,
    }
    // web_search はサーバーサイド tool; SDK バージョンに依存しないよう緩い cast。
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
        system: cacheableSystemPrompt(spec.systemPrompt),
        tools: [cardTool, webSearchTool],
        tool_choice: { type: 'auto' },
        messages,
      })

      const submit = res.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === spec.toolName,
      )
      if (submit) return submit.input

      // Server tool (web_search) がターン上限に達した → model が続行できるよう resend。
      if ((res.stop_reason as string) === 'pause_turn') {
        messages.push({ role: 'assistant', content: res.content })
        continue
      }

      // Model が提出せずに停止 → 提出するよう促してから再試行。
      messages.push({ role: 'assistant', content: res.content })
      messages.push({ role: 'user', content: `Call the ${spec.toolName} tool to submit the final result.` })
    }

    throw new Error('Model did not submit card after web_search loop')
  }
}

function extractToolInput(res: Anthropic.Message, toolName: string): unknown {
  const block = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === toolName,
  )
  if (!block) {
    throw new Error(`Model did not return the ${toolName} tool call`)
  }
  return block.input
}
