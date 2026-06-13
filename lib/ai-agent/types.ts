import type { FormType, LanguageType } from '@/types'

/**
 * Tham số đầu vào để sinh nội dung một thẻ. Giữ tương thích với contract cũ
 * của `/api/generate` (word/term/form_type/language/topics).
 */
export interface GenerateCardInput {
  word?: string
  term?: string
  form_type: FormType
  language?: LanguageType
  topics?: string[]
}

/**
 * Abstraction cho provider AI sinh nội dung thẻ — mirror pattern của
 * `IFlashcardService` (lib/flashcard-service). Cho phép thay provider sau này.
 */
export interface IAIAgentProvider {
  generateCard(input: GenerateCardInput): Promise<Record<string, unknown>>
}
