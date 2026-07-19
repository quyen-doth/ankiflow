import { z } from 'zod'
import { toToolInputSchema } from '@/lib/ai-agent/card-spec'
import type { CardSpec } from '@/lib/ai-agent/card-spec'
import type { SuggestInstructionInput } from '@/lib/ai-agent/types'

export const instructionSuggestionResultSchema = z.object({
  instruction: z.string().trim().min(1).max(300),
})

/** Output field の自然言語要件から短い English instruction を作る tool spec。 */
export function buildInstructionSuggestionSpec(input: SuggestInstructionInput): CardSpec {
  const emptyValue = input.type === 'string_array' ? 'an empty array' : 'an empty string'
  const schema = instructionSuggestionResultSchema as unknown as z.ZodType<Record<string, unknown>>

  return {
    toolName: 'submit_instruction_suggestion',
    toolDescription: 'Submit one concise AI output-field instruction.',
    systemPrompt: `You write concise English instructions for a structured flashcard generation schema.
Each instruction must state what to return, the required format or constraints, and an explicit edge case beginning with "Return ${emptyValue} if...".
Use {output_language} and {study_language} placeholders only when they are relevant to the requested output.
Do not use Markdown, headings, quotation marks, or the field key as a prefix. Keep the instruction at or below 300 characters.`,
    userMessage: `Field key: ${input.fieldKey}
Output type: ${input.type}
User description: ${input.description.trim()}`,
    schema,
    inputSchema: toToolInputSchema(schema),
  }
}
