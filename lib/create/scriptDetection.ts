import { canonicalizeLanguageCode } from '@/lib/studyLanguages'
import type { LanguageDetection, LanguageDetectionCandidate } from '@/lib/ai-agent'

// Latin 文字は複数言語で共有されるため、ほぼ固有の文字体系だけを対象にする。
const SCRIPT_RULES: Array<{ code: string; pattern: RegExp }> = [
  { code: 'ja', pattern: /[\p{Script=Hiragana}\p{Script=Katakana}]/u },
  { code: 'ko', pattern: /\p{Script=Hangul}/u },
  { code: 'th', pattern: /\p{Script=Thai}/u },
]

const HAN_ONLY = /^[\p{Script=Han}\p{P}\p{N}\s]+$/u
const HAS_HAN = /\p{Script=Han}/u

function primarySubtag(code: string): string | null {
  return canonicalizeLanguageCode(code)?.split('-')[0]?.toLowerCase() ?? null
}

/**
 * 全 item を同一言語へ確実に解決でき、その言語が候補に存在する場合のみ返す。
 * 曖昧な文字体系は null にして AI 判定へフォールバックする。
 */
export function detectByScript(
  items: string[],
  candidates: LanguageDetectionCandidate[],
): LanguageDetection[] | null {
  if (items.length === 0) return null

  const candidatePrimaries = new Set(candidates.map(candidate => primarySubtag(candidate.code)))
  const detectedCodes: string[] = []

  for (const rawItem of items) {
    const item = rawItem.trim()
    if (!item) return null

    const rule = SCRIPT_RULES.find(candidate => candidate.pattern.test(item))
    if (rule) {
      detectedCodes.push(rule.code)
      continue
    }

    if (HAS_HAN.test(item) && HAN_ONLY.test(item)) {
      // 漢字だけの語は日本語の可能性もあるため、ja 候補があれば AI に委ねる。
      if (candidatePrimaries.has('ja')) return null
      detectedCodes.push('zh')
      continue
    }

    return null
  }

  const uniqueCodes = new Set(detectedCodes)
  if (uniqueCodes.size !== 1) return null

  const detectedCode = detectedCodes[0]
  const candidate = candidates.find(item => primarySubtag(item.code) === detectedCode)
  if (!candidate) return null

  const canonicalCode = canonicalizeLanguageCode(candidate.code)
  if (!canonicalCode) return null

  return items.map((_, index) => ({
    index,
    code: canonicalCode,
    display_name: candidate.display_name,
    confidence: 1,
  }))
}
