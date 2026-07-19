import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminDb } from '@/lib/firebase-admin'
import { verifyStaticToken } from '@/lib/auth-guard'
import { normalizeTerm } from '@/lib/entries/duplicate'
import { canonicalizeLanguageCode } from '@/lib/studyLanguages'
import { FormType } from '@/types'

/**
 * POST /api/integrations/term-drafts — 外部システム (Knowledge Hub) から term draft を受け取る。
 * session cookie は使わない (外部 client は持たない)。auth は header `x-integration-token` を
 * `INTEGRATION_TOKEN` と比較 (constant-time)。draft はすべて固定の 1 user
 * (`INTEGRATION_TARGET_UID`) に作成 — route は /api/generate を呼ばず、user が UI から確認 + Generate する。
 */

const DEFAULT_DECK_NAME = 'Vocabulary::IT'
const DEFAULT_CARD_TYPE_IDS: string[] = []

const itemSchema = z.object({
  term: z.string().trim().min(1),
  language: z.string().transform((value, context) => {
    const code = canonicalizeLanguageCode(value)
    if (!code) {
      context.addIssue({ code: 'custom', message: 'language must be a valid BCP 47 code' })
      return z.NEVER
    }
    return code
  }),
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

    // Duplicate check: query は 1 回だけ、メモリ内で比較 (app/api/entries/check-duplicate と同様)。
    const existingSnap = await db.collection('entries').where('user_id', '==', targetUid).get()
    const existingNormalized = new Set(
      existingSnap.docs.map((doc) => {
        const data = doc.data()
        return normalizeTerm(data.word || data.term || data.title || '')
      }),
    )

    // Default anki_deck/card_type_ids: target user 自身の form_it 既定 deck から取得。
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
