export const DUPLICATE_LOOKUP_BATCH_LIMIT = 100

/** 重複照合用に単語/用語を正規化する — `app/api/entries/check-duplicate/route.ts` と
 * `app/api/integrations/term-drafts/route.ts` で共用。 */
export function normalizeTerm(term: string): string {
  return term.toLowerCase().trim()
}

/** 既存 duplicate semantics: word → term → title の順で最初の non-empty string を使う。 */
export function entryPrimaryValue(data: Record<string, unknown>): string {
  const value = [data.word, data.term, data.title]
    .find(candidate => typeof candidate === 'string' && candidate.length > 0)
  return typeof value === 'string' ? value : ''
}

export function normalizedEntryPrimaryValue(data: Record<string, unknown>): string {
  return normalizeTerm(entryPrimaryValue(data))
}
