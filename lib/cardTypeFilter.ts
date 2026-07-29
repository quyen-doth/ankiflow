import { matchesLanguageScope } from '@/lib/studyLanguages'

export interface CardTypeScopeLike {
  language?: string | null;
  output_language?: string | null;
  is_active?: boolean;
  is_default?: boolean;
  sort_order?: number;
}

interface CardTypeFilterOptions {
  studyLanguage?: string | null;
  outputLanguage?: string | null;
}

/**
 * Card Type を学習言語と出力言語の両方で絞り込む。
 * null scope は universal として扱うが、言語 pair と不一致の default は返さない。
 */
export function filterCardTypesByScope<T extends CardTypeScopeLike>(
  cardTypes: T[],
  options: CardTypeFilterOptions,
): T[] {
  const activeCardTypes = cardTypes.filter(cardType => cardType.is_active !== false)
  const matchedCardTypes = activeCardTypes.filter(cardType => (
    matchesLanguageScope(cardType.language, options.studyLanguage)
    && matchesLanguageScope(cardType.output_language, options.outputLanguage)
  ))

  return [...matchedCardTypes].sort(
    (left, right) => (left.sort_order || 0) - (right.sort_order || 0),
  )
}
