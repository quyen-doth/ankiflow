import {
  canonicalizeLanguageCode,
  inferLanguageDisplayName,
} from '@/lib/studyLanguages'

// 言語カタログ — picker の候補リスト。名前は Intl.DisplayNames で実行時に生成するため
// code のみを保持する (名前テーブルの保守が不要)。ISO 標準の静的データなので Firestore
// ではなく code に置く (ユーザー決定 2026-07-15)。
export const LANGUAGE_CATALOG_CODES: readonly string[] = [
  'en', 'ja', 'zh', 'zh-TW', 'ko', 'vi', 'fr', 'de', 'es', 'es-MX', 'pt', 'pt-BR', 'it', 'ru', 'uk',
  'pl', 'cs', 'sk', 'ro', 'hu', 'bg', 'el', 'nl', 'sv', 'nb', 'da', 'fi', 'et', 'lv', 'lt', 'tr',
  'ar', 'he', 'fa', 'ur', 'hi', 'bn', 'ta', 'te', 'ml', 'mr', 'gu', 'kn', 'pa', 'si', 'ne',
  'th', 'lo', 'km', 'my', 'id', 'ms', 'fil', 'sw', 'am', 'yo', 'ig', 'ha', 'zu', 'af',
  'sq', 'sr', 'hr', 'bs', 'sl', 'mk', 'ka', 'hy', 'az', 'kk', 'uz', 'ky', 'mn',
  'ca', 'eu', 'gl', 'is', 'ga', 'cy', 'eo',
]

export interface CatalogLanguage {
  code: string
  display_name: string
}

let catalog: CatalogLanguage[] | null = null

/** Intl で canonicalize・表示名生成・並び替えを初回だけ行う。 */
export function listLanguageCatalog(): CatalogLanguage[] {
  if (catalog) return catalog

  catalog = LANGUAGE_CATALOG_CODES.map(code => {
    const canonical = canonicalizeLanguageCode(code)
    if (!canonical) throw new Error(`Invalid language catalog code: ${code}`)
    return {
      code: canonical,
      display_name: inferLanguageDisplayName(canonical),
    }
  }).sort((a, b) => (
    a.display_name.localeCompare(b.display_name, 'en') || a.code.localeCompare(b.code, 'en')
  ))

  return catalog
}
