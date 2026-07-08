import type { FormType, LanguageType } from '@/types'

/**
 * カード 1 枚のコンテンツを生成するための入力パラメータ。`/api/generate` の
 * 旧 contract (word/term/form_type/language/topics) との互換性を維持。
 */
export interface GenerateCardInput {
  word?: string
  term?: string
  form_type: FormType | string
  language?: LanguageType
  topics?: string[]
  /** Dynamic fields from custom content types */
  dynamicFields?: Record<string, string>
  /** Name of the custom content type (for prompt context) */
  contentTypeName?: string
}

/**
 * カードコンテンツを生成する AI provider の Abstraction — `IFlashcardService`
 * (lib/flashcard-service) のパターンを鏡写しにしている。将来 provider を
 * 差し替え可能にする。
 */
export interface IAIAgentProvider {
  generateCard(input: GenerateCardInput): Promise<Record<string, unknown>>
}
