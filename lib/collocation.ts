/** "term (gloss)" を { term, gloss } に分解。括弧がなければ term のみ。 */
export function parseColloc(raw: string): { term: string; gloss?: string } {
  const m = raw.match(/^(.*?)\s*\((.*)\)\s*$/)
  if (m) return { term: m[1].trim(), gloss: m[2].trim() }
  return { term: raw }
}
