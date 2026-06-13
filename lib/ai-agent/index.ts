import { ClaudeAgentProvider } from './claude-agent-provider'
import type { IAIAgentProvider } from './types'

export type { GenerateCardInput, IAIAgentProvider } from './types'

/** Model Claude mặc định cho sinh nội dung thẻ. */
export const DEFAULT_AI_MODEL = 'claude-haiku-4-5'

/** Danh sách model Claude được phép chọn trong Settings. */
export const SUPPORTED_AI_MODELS = ['claude-haiku-4-5', 'claude-sonnet-4-6'] as const
export type SupportedAIModel = (typeof SUPPORTED_AI_MODELS)[number]

/** Trả model hợp lệ; fallback về Haiku nếu thiếu/không thuộc allow-list. */
export function resolveModel(model?: string | null): string {
  return model && (SUPPORTED_AI_MODELS as readonly string[]).includes(model)
    ? model
    : DEFAULT_AI_MODEL
}

export interface CreateAIAgentOptions {
  model?: string | null
  webSearchEnabled?: boolean
}

// Factory — mirror lib/flashcard-service. Sau này thêm provider khác tại đây.
export function createAIAgentProvider(opts: CreateAIAgentOptions = {}): IAIAgentProvider {
  return new ClaudeAgentProvider(resolveModel(opts.model), opts.webSearchEnabled ?? false)
}
