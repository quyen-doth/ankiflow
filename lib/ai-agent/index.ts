import { ClaudeAgentProvider } from './claude-agent-provider'
import type { IAIAgentProvider } from './types'

export type {
  DetectLanguagesInput,
  GenerateCardInput,
  IAIAgentProvider,
  LanguageDetection,
  LanguageDetectionCandidate,
} from './types'

/** カードコンテンツ生成用のデフォルト Claude モデル。 */
export const DEFAULT_AI_MODEL = 'claude-haiku-4-5'

/** Settings で選択可能な Claude モデルのリスト。 */
export const SUPPORTED_AI_MODELS = ['claude-haiku-4-5', 'claude-sonnet-4-6'] as const
export type SupportedAIModel = (typeof SUPPORTED_AI_MODELS)[number]

/** 有効なモデルを返す; 不足/allow-list に含まれない場合は Haiku にフォールバック。 */
export function resolveModel(model?: string | null): string {
  return model && (SUPPORTED_AI_MODELS as readonly string[]).includes(model)
    ? model
    : DEFAULT_AI_MODEL
}

export interface CreateAIAgentOptions {
  model?: string | null
  webSearchEnabled?: boolean
}

// Factory — lib/flashcard-service を鏡写し。今後別の provider をここに追加する。
export function createAIAgentProvider(opts: CreateAIAgentOptions = {}): IAIAgentProvider {
  return new ClaudeAgentProvider(resolveModel(opts.model), opts.webSearchEnabled ?? false)
}
