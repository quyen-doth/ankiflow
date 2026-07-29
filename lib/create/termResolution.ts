import { z } from 'zod'
import { canonicalizeLanguageCode } from '@/lib/studyLanguages'
import type { LanguageDetectionCandidate, TermResolution } from '@/lib/ai-agent'

const responseSchema = z.object({
  resolutions: z.array(z.object({
    index: z.number().int().nonnegative(),
    resolved_term: z.string().min(1),
    source_language: z.string().min(1),
    was_translated: z.boolean(),
  })),
})

/**
 * 入力語を学習言語 (targetLanguage) の語へ揃える。学習言語は user の選択が正で、
 * 入力の言語によって上書きされない。
 */
export async function resolveTermsForTarget(
  items: string[],
  targetLanguage: LanguageDetectionCandidate,
  signal?: AbortSignal,
): Promise<TermResolution[]> {
  const response = await fetch('/api/languages/resolve-terms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, target_language: targetLanguage }),
    signal,
  })
  const body: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof body === 'object' && body && 'error' in body
      ? String(body.error)
      : 'Failed to resolve terms'
    throw new Error(message)
  }

  const parsed = responseSchema.parse(body)
  if (parsed.resolutions.length !== items.length) {
    throw new Error('Term resolution response is incomplete')
  }

  return parsed.resolutions.map(resolution => {
    const sourceLanguage = canonicalizeLanguageCode(resolution.source_language)
    if (!sourceLanguage) {
      throw new Error(`Invalid source language code: ${resolution.source_language}`)
    }
    return { ...resolution, source_language: sourceLanguage }
  })
}
