import { z } from 'zod'
import type { CardSpec } from '@/lib/ai-agent/card-spec'
import type { ResolveTermsInput } from '@/lib/ai-agent/types'

export const TERM_RESOLUTION_TOOL_NAME = 'submit_term_resolution'

export const termResolutionResultSchema = z.object({
  resolutions: z.array(z.object({
    index: z.number().int().nonnegative(),
    resolved_term: z.string().min(1).max(200),
    source_language: z.string().min(1),
    was_translated: z.boolean(),
  })),
})

/**
 * 学習言語 (targetLanguage) を正として、入力語をその言語の語へ揃える。
 * 入力の言語を判定して学習言語を上書きするのではなく、逆に入力を学習言語へ寄せる。
 */
export function buildTermResolutionSpec(input: ResolveTermsInput): CardSpec {
  const { code, display_name } = input.targetLanguage
  const items = input.items.map((item, index) => `${index}: ${JSON.stringify(item)}`).join('\n')

  const systemPrompt = `You normalize vocabulary items for a flashcard application.
The target study language is ${display_name} (${code}). It is authoritative — never change it.
Return one resolution for every input index through the ${TERM_RESOLUTION_TOOL_NAME} tool.

Rules:
- If an item is already ${display_name}, return it unchanged and set was_translated to false.
- Otherwise return the single most common ${display_name} vocabulary equivalent and set was_translated to true.
- resolved_term must contain only the term itself — no readings, no romanization, no parentheses, no glosses, no explanations, and no punctuation that was not in the input.
- Prefer the plain dictionary form a learner would study.
- source_language is the canonical BCP 47 code of the item as supplied, using the shortest sufficiently precise tag.
- Han characters alone do not imply Chinese; judge from vocabulary and usage, not script.
- Preserve every input index exactly once and in ascending order.`

  const userMessage = `Target study language: ${code}: ${display_name}\n\nItems:\n${items}`

  return {
    toolName: TERM_RESOLUTION_TOOL_NAME,
    toolDescription: `Submit the ${display_name} form of every vocabulary item.`,
    systemPrompt,
    userMessage,
    schema: termResolutionResultSchema as unknown as z.ZodType<Record<string, unknown>>,
    inputSchema: {
      type: 'object',
      properties: {
        resolutions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              index: { type: 'integer', minimum: 0 },
              resolved_term: { type: 'string' },
              source_language: { type: 'string' },
              was_translated: { type: 'boolean' },
            },
            required: ['index', 'resolved_term', 'source_language', 'was_translated'],
            additionalProperties: false,
          },
        },
      },
      required: ['resolutions'],
      additionalProperties: false,
    },
  }
}
