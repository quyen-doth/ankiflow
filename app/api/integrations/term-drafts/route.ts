import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminDb } from '@/lib/firebase-admin'
import { verifyStaticToken } from '@/lib/auth-guard'
import { normalizeTerm } from '@/lib/entries/duplicate'
import { FormType } from '@/types'

/**
 * POST /api/integrations/term-drafts — nhận term draft từ hệ thống ngoài (Knowledge Hub).
 * KHÔNG dùng session cookie (client ngoài không có), auth bằng header `x-integration-token`
 * so `INTEGRATION_TOKEN` (constant-time). Mọi draft tạo cho 1 user cố định
 * (`INTEGRATION_TARGET_UID`) — route KHÔNG gọi /api/generate, user tự duyệt + Generate từ UI.
 */

const DEFAULT_DECK_NAME = 'Vocabulary::IT'
const DEFAULT_CARD_TYPE_IDS: string[] = []

const itemSchema = z.object({
  term: z.string().trim().min(1),
  language: z.enum(['en', 'ja']),
  definition_hint_vi: z.string().optional(),
  context_quote: z.string().max(200).optional(),
  source_url: z.string().min(1),
  source_title: z.string().min(1),
})

const bodySchema = z.object({
  source: z.literal('knowledge-hub'),
  items: z.array(itemSchema).min(1).max(20),
})

export async function POST(request: Request) {
  const token = request.headers.get('x-integration-token')
  if (!verifyStaticToken(token, process.env.INTEGRATION_TOKEN)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const targetUid = process.env.INTEGRATION_TARGET_UID
  if (!targetUid) {
    return NextResponse.json({ error: 'INTEGRATION_TARGET_UID not configured' }, { status: 500 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 })
  }
  const { items } = parsed.data

  try {
    const db = getAdminDb()

    // Duplicate check: 1 query duy nhất, so trong bộ nhớ (giống app/api/entries/check-duplicate).
    const existingSnap = await db.collection('entries').where('user_id', '==', targetUid).get()
    const existingNormalized = new Set(
      existingSnap.docs.map((doc) => {
        const data = doc.data()
        return normalizeTerm(data.word || data.term || data.title || '')
      }),
    )

    // Default anki_deck/card_type_ids: lấy từ deck mặc định form_it của chính target user.
    const deckSnap = await db
      .collection('decks')
      .where('user_id', '==', targetUid)
      .where('form_type', '==', FormType.IT)
      .limit(1)
      .get()
    const deckDoc = deckSnap.docs[0]?.data()
    const ankiDeck = deckDoc?.anki_deck_name ?? DEFAULT_DECK_NAME
    const defaultCardTypeIds: string[] = deckDoc?.default_card_type_ids ?? DEFAULT_CARD_TYPE_IDS

    const created: string[] = []
    const skipped: Array<{ term: string; reason: string }> = []
    const seenInBatch = new Set<string>()

    const batch = db.batch()
    for (const item of items) {
      const normalized = normalizeTerm(item.term)
      if (existingNormalized.has(normalized) || seenInBatch.has(normalized)) {
        skipped.push({ term: item.term, reason: 'duplicate' })
        continue
      }
      seenInBatch.add(normalized)

      const ref = db.collection('entries').doc()
      batch.set(ref, {
        user_id: targetUid,
        term: item.term,
        language: item.language,
        form_type: FormType.IT,
        status: 'draft',
        category_id: null,
        anki_deck: ankiDeck,
        card_type_ids: defaultCardTypeIds,
        tags: [],
        anki_note_ids: [],
        meaning_vi: item.definition_hint_vi,
        integration_source: 'knowledge-hub',
        source_url: item.source_url,
        source_title: item.source_title,
        context_quote: item.context_quote,
        created_at: new Date(),
        updated_at: new Date(),
      })
      created.push(ref.id)
    }

    if (created.length > 0) {
      await batch.commit()
    }

    return NextResponse.json({ created, skipped })
  } catch (error) {
    console.error('term-drafts error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
