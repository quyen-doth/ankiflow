import { z } from 'zod'

export const TOOL_NAME = 'submit_card'

/** Schema, prompt, and Anthropic tool contract for one generation request. */
export interface CardSpec {
  toolName: string
  toolDescription: string
  systemPrompt: string
  userMessage: string
  schema: z.ZodType<Record<string, unknown>>
  inputSchema: Record<string, unknown>
}

/** Convert a Zod object to a strict Anthropic tool input schema. */
export function toToolInputSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as { properties?: Record<string, unknown> }
  const properties = json.properties ?? {}
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  }
}
