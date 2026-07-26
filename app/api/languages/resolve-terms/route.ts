import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth-guard'
import { createAIAgentProvider } from '@/lib/ai-agent'
import { readAISettings } from '@/lib/ai-settings'
import { canonicalizeLanguageCode } from '@/lib/studyLanguages'

const MAX_RESOLUTION_ITEMS = 100

const requestSchema = z.object({
  items: z.array(z.string().trim().min(1).max(200)).min(1).max(MAX_RESOLUTION_ITEMS),
  target_language: z.object({
    code: z.string().trim().min(1).max(35).refine(
      code => canonicalizeLanguageCode(code) !== null,
      'Invalid BCP 47 language code',
    ),
    display_name: z.string().trim().min(1).max(80),
  }),
})

export const POST = withAuth(async request => {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
    }
    const parsed = requestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Invalid term resolution request. Use 1-${MAX_RESOLUTION_ITEMS} non-empty items and a valid target language.` },
        { status: 400 },
      )
    }

    const code = canonicalizeLanguageCode(parsed.data.target_language.code)
    if (!code) {
      return NextResponse.json(
        { error: `Invalid target BCP 47 code: ${parsed.data.target_language.code}` },
        { status: 400 },
      )
    }

    const { model } = await readAISettings()
    const provider = createAIAgentProvider({ model, webSearchEnabled: false })
    const resolutions = await provider.resolveTerms({
      items: parsed.data.items,
      targetLanguage: { code, display_name: parsed.data.target_language.display_name },
    })

    return NextResponse.json({ resolutions })
  } catch (error) {
    console.error('Term Resolution Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resolve terms' },
      { status: 500 },
    )
  }
})
