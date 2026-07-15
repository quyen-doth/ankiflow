import { z } from 'zod'
import type { CardSpec } from '@/lib/ai-agent/card-schemas'
import type { DetectLanguagesInput } from '@/lib/ai-agent/types'

export const LANGUAGE_DETECTION_TOOL_NAME = 'submit_language_detection'

export const languageDetectionResultSchema = z.object({
  detections: z.array(z.object({
    index: z.number().int().nonnegative(),
    code: z.string().min(1),
    display_name: z.string().min(1),
    confidence: z.number().min(0).max(1),
  })),
})

export function buildLanguageDetectionSpec(input: DetectLanguagesInput): CardSpec {
  const candidates = input.candidateLanguages.length > 0
    ? input.candidateLanguages.map(language => `${language.code}: ${language.display_name}`).join('\n')
    : '(none)'
  const items = input.items.map((item, index) => `${index}: ${JSON.stringify(item)}`).join('\n')

  const systemPrompt = `You identify the natural language of vocabulary items for a flashcard application.
Return one detection for every input index through the submit_language_detection tool.

Rules:
- Prefer an exact code from the configured candidate list when it accurately represents the item.
- Otherwise return a canonical BCP 47 language code, using the shortest sufficiently precise tag.
- Use English for display_name.
- confidence is a number from 0 to 1.
- Preserve every input index exactly once and in ascending order.
- Never default to English merely because an item uses Latin script.
- For short or ambiguous vocabulary, make the best linguistic judgment from spelling and script.`

  const userMessage = `Configured language candidates:\n${candidates}\n\nItems:\n${items}`

  return {
    toolName: LANGUAGE_DETECTION_TOOL_NAME,
    toolDescription: 'Submit the detected BCP 47 language for every vocabulary item.',
    systemPrompt,
    userMessage,
    schema: languageDetectionResultSchema as unknown as z.ZodType<Record<string, unknown>>,
    inputSchema: {
      type: 'object',
      properties: {
        detections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              index: { type: 'integer', minimum: 0 },
              code: { type: 'string' },
              display_name: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
            },
            required: ['index', 'code', 'display_name', 'confidence'],
            additionalProperties: false,
          },
        },
      },
      required: ['detections'],
      additionalProperties: false,
    },
  }
}
