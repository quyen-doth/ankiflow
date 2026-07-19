import { primaryLanguageSubtag } from '@/lib/studyLanguages'

export interface LanguageProfile {
  /** English specialist label used by the shared system prompt. */
  expertLabel: string
  /** Schema description だけでは表現しにくい言語固有ルール。 */
  promptNotes: string[]
}

export const LANGUAGE_PROFILES: Readonly<Record<string, LanguageProfile>> = {
  en: {
    expertLabel: 'English language',
    promptNotes: [
      'Example sentences must be concise (12 words or fewer), easy to understand, and natural.',
      'Provide 3-5 common phrases or collocations with meanings in the output language in parentheses.',
    ],
  },
  zh: {
    expertLabel: 'Chinese language',
    promptNotes: [
      'Example sentences must be concise (10 words or fewer), grammatically correct, and natural in everyday use.',
      'Provide 3-5 common phrases or measure-word combinations with meanings in the output language.',
      'For nouns, include appropriate measure words, for example 一本书 or 一杯水.',
      'Use the HSK level when it can be determined, for example HSK1.',
    ],
  },
  ja: {
    expertLabel: 'Japanese language',
    promptNotes: [
      'Example sentences must be concise (10 words or fewer), grammatically correct, and natural.',
      'Provide 3-5 common phrases or particle combinations with meanings in the output language.',
      'Fill katakana only for loanwords; otherwise return an empty string.',
      'Fill romaji and all reading fields accurately.',
      'Use the JLPT level when it can be determined, for example N5.',
      'When han_viet is present in the schema, return an empty string for words written entirely in kana.',
    ],
  },
}

export function getLanguageProfile(code: string | undefined): LanguageProfile | null {
  if (!code) return null
  const primary = primaryLanguageSubtag(code)
  return primary ? LANGUAGE_PROFILES[primary] ?? null : null
}
