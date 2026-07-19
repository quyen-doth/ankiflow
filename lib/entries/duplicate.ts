/** 重複照合用に単語/用語を正規化する — `app/api/entries/check-duplicate/route.ts` と
 * `app/api/integrations/term-drafts/route.ts` で共用。 */
export function normalizeTerm(term: string): string {
  return term.toLowerCase().trim()
}
