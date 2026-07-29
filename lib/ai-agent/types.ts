import type { FormType, LanguageCode } from '@/types'
import type { EngineDefinition } from '@/lib/ai-agent/promptEngine'

/**
 * カード 1 枚のコンテンツを生成するための入力パラメータ。`/api/generate` の
 * 旧 contract (word/term/form_type/language/topics) との互換性を維持。
 */
export interface GenerateCardInput {
  word?: string
  term?: string
  form_type: FormType | string
  language?: LanguageCode
  language_name?: string
  output_language?: LanguageCode
  output_language_name?: string
  topics?: string[]
  /** Dynamic fields from custom content types */
  dynamicFields?: Record<string, string>
  /** Name of the custom content type (for prompt context) */
  contentTypeName?: string
  /** Server-validated workspace definition. Older requests may omit it and use an engine-derived fallback. */
  content_type?: EngineDefinition
}

export interface LanguageDetectionCandidate {
  code: LanguageCode
  display_name: string
}

export interface DetectLanguagesInput {
  items: string[]
  candidateLanguages: LanguageDetectionCandidate[]
}

export interface LanguageDetection {
  index: number
  code: LanguageCode
  display_name: string
  confidence: number
}

export interface ResolveTermsInput {
  items: string[]
  /** 学習言語 — 入力の言語ではなく、こちらが正 (authoritative)。 */
  targetLanguage: LanguageDetectionCandidate
}

export interface TermResolution {
  index: number
  /** targetLanguage における語。翻訳が不要なら入力そのもの。 */
  resolved_term: string
  source_language: LanguageCode
  was_translated: boolean
}

export interface SuggestInstructionInput {
  fieldKey: string
  type: 'string' | 'string_array'
  description: string
}

/**
 * カードコンテンツを生成する AI provider の Abstraction — `IFlashcardService`
 * (lib/flashcard-service) のパターンを鏡写しにしている。将来 provider を
 * 差し替え可能にする。
 */
export interface IAIAgentProvider {
  generateCard(input: GenerateCardInput): Promise<Record<string, unknown>>
  detectLanguages(input: DetectLanguagesInput): Promise<LanguageDetection[]>
  resolveTerms(input: ResolveTermsInput): Promise<TermResolution[]>
  suggestInstruction(input: SuggestInstructionInput): Promise<string>
}
