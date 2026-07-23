import type { Entry } from '@/types'

function nonBlankString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * legacy AI output key を canonical Entry key へ補完する。
 * canonical value が空の場合だけ alias を使い、元 object は変更しない。
 */
export function normalizeEntryAliases<T extends Partial<Entry>>(entry: T): T {
  const raw = entry as T & Record<string, unknown>
  const wordType = nonBlankString(entry.word_type)
    ?? nonBlankString(raw.word_type_vi)
  const definition = nonBlankString(entry.definition)
    ?? nonBlankString(raw.definition_vi)
  const example = nonBlankString(entry.example_sentence)
    ?? nonBlankString(raw.example_usage)

  return {
    ...entry,
    ...(wordType ? { word_type: wordType } : {}),
    ...(definition ? { definition } : {}),
    ...(example ? { example_sentence: example } : {}),
  }
}
