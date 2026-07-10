import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth-guard'
import { createAIAgentProvider } from '@/lib/ai-agent'
import { readAISettings } from '@/lib/ai-settings'
import { canonicalizeLanguageCode } from '@/lib/studyLanguages'

const MAX_DETECTION_ITEMS = 100

const requestSchema = z.object({
  items: z.array(z.string().trim().min(1).max(200)).min(1).max(MAX_DETECTION_ITEMS),
  candidate_languages: z.array(z.object({
    code: z.string().trim().min(1).max(35).refine(
      code => canonicalizeLanguageCode(code) !== null,
      'Invalid BCP 47 language code',
    ),
    display_name: z.string().trim().min(1).max(80),
  })).max(100),
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
        { error: `Invalid language detection request. Use 1-${MAX_DETECTION_ITEMS} non-empty items.` },
        { status: 400 },
      )
    }

    const candidateLanguages = parsed.data.candidate_languages.map(language => {
      const code = canonicalizeLanguageCode(language.code)
      if (!code) throw new Error(`Invalid candidate BCP 47 code: ${language.code}`)
      return { code, display_name: language.display_name }
    })

    const { model } = await readAISettings()
    const provider = createAIAgentProvider({ model, webSearchEnabled: false })
    const detections = await provider.detectLanguages({
      items: parsed.data.items,
      candidateLanguages,
    })

    return NextResponse.json({ detections })
  } catch (error) {
    console.error('Language Detection Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to detect language' },
      { status: 500 },
    )
  }
})
