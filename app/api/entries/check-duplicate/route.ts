import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminDb } from '@/lib/firebase-admin'
import { withAuth } from '@/lib/auth-guard'
import { DUPLICATE_LOOKUP_BATCH_LIMIT } from '@/lib/entries/duplicate'
import { lookupEntryDuplicates } from '@/lib/entries/duplicateLookup'

const targetSchema = z.string().trim().min(1)
const bodySchema = z.object({
  word: targetSchema.optional(),
  words: z.array(targetSchema).max(DUPLICATE_LOOKUP_BATCH_LIMIT).optional(),
})

export const POST = withAuth(async (request, _ctx, uid) => {
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', issues: parsed.error.issues },
        { status: 400 },
      )
    }
    const { word, words } = parsed.data

    // チェック対象の単語一覧: `words` (batch) を優先し、`word` (single) に fallback。
    const targets = words ?? (word ? [word] : [])
    if (targets.length === 0) {
      return NextResponse.json({ error: 'Missing word' }, { status: 400 })
    }

    const results = await lookupEntryDuplicates(getAdminDb(), uid, targets)

    // Batch: 単語ごとの結果配列を返す。
    if (words !== undefined) {
      return NextResponse.json({ results })
    }

    // Single: 後方互換。
    const duplicates = results[0]?.duplicates ?? []
    return NextResponse.json({
      isDuplicate: duplicates.length > 0,
      duplicates,
    })
  } catch (error) {
    console.error('Check duplicate error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
})
