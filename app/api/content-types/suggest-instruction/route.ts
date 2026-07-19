import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createAIAgentProvider } from '@/lib/ai-agent'
import {
  AI_OUTPUT_FIELD_KEY_PATTERN,
  RESERVED_AI_OUTPUT_KEYS,
} from '@/lib/ai-agent/outputProfiles'
import { readAISettings } from '@/lib/ai-settings'
import { withAuth } from '@/lib/auth-guard'

const suggestInstructionRequestSchema = z.object({
  field_key: z.string()
    .trim()
    .regex(AI_OUTPUT_FIELD_KEY_PATTERN, 'field_key must use lowercase snake_case')
    .refine(key => !RESERVED_AI_OUTPUT_KEYS.has(key), 'field_key is reserved by the application'),
  type: z.enum(['string', 'string_array']),
  description: z.string().trim().min(1).max(300),
})

export const POST = withAuth(async request => {
  let requestBody: unknown
  try {
    requestBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = suggestInstructionRequestSchema.safeParse(requestBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  try {
    const { model, webSearchEnabled } = await readAISettings()
    const provider = createAIAgentProvider({ model, webSearchEnabled })
    const instruction = await provider.suggestInstruction({
      fieldKey: parsed.data.field_key,
      type: parsed.data.type,
      description: parsed.data.description,
    })
    return NextResponse.json({ instruction })
  } catch (error) {
    console.error('Instruction suggestion error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Instruction suggestion failed' },
      { status: 500 },
    )
  }
})
