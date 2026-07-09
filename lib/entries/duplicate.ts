/** Chuẩn hóa từ/thuật ngữ để so khớp trùng lặp — dùng chung giữa
 * `app/api/entries/check-duplicate/route.ts` và `app/api/integrations/term-drafts/route.ts`. */
export function normalizeTerm(term: string): string {
  return term.toLowerCase().trim()
}
