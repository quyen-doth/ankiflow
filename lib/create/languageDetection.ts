import { z } from 'zod'
import { canonicalizeLanguageCode } from '@/lib/studyLanguages'
import type { LanguageDetection, LanguageDetectionCandidate } from '@/lib/ai-agent'

const responseSchema = z.object({
  detections: z.array(z.object({
    index: z.number().int().nonnegative(),
    code: z.string().min(1),
    display_name: z.string().min(1),
    confidence: z.number().min(0).max(1),
  })),
})

export async function detectItemLanguages(
  items: string[],
  candidateLanguages: LanguageDetectionCandidate[],
  signal?: AbortSignal,
): Promise<LanguageDetection[]> {
  const response = await fetch('/api/languages/detect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, candidate_languages: candidateLanguages }),
    signal,
  })
  const body: unknown = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof body === 'object' && body && 'error' in body
      ? String(body.error)
      : 'Failed to detect language'
    throw new Error(message)
  }

  const parsed = responseSchema.parse(body)
  if (parsed.detections.length !== items.length) {
    throw new Error('Language detection response is incomplete')
  }

  return parsed.detections.map(detection => {
    const code = canonicalizeLanguageCode(detection.code)
    if (!code) throw new Error(`Invalid detected language code: ${detection.code}`)
    return { ...detection, code }
  })
}
export function formatMixedLanguageError(
  items: string[],
  detections: LanguageDetection[],
): string | null {
  const codes = new Set(detections.map(detection => detection.code.toLowerCase()))
  if (codes.size <= 1) return null
  const details = detections.map(detection => (
    `#${detection.index + 1} “${items[detection.index]}” → ${detection.display_name} (${detection.code})`
  ))
  return `A batch can contain only one language. Split these items into separate batches: ${details.join('; ')}`
}
