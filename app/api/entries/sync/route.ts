import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminDb } from '@/lib/firebase-admin'
import { withAuth } from '@/lib/auth-guard'
import { fetchCardTypesByIds } from '@/lib/firestore-helpers'
import type { CardTypeItem } from '@/lib/buildNotes'
import type { Entry } from '@/types'

/**
 * GET — `reviewed` の entry を card_types (template 込み) と共に返し、CLIENT が
 * buildNotes して Anki に作成する。Server は AnkiConnect を呼ばない (Vercel で動作可能)。
 * 注意: entry は audio_url/image_url (data-URL) を保持したまま返す — client が addNotes の
 * 前に Anki media へ storeMediaFile するために必要 (createNotesForEntry)。
 */
export const GET = withAuth(async (_request, _ctx, uid) => {
  const db = getAdminDb()

  const snapshot = await db
    .collection('entries')
    .where('user_id', '==', uid)
    .where('status', '==', 'reviewed')
    .get()
  if (snapshot.empty) {
    return NextResponse.json({ jobs: [] })
  }

  const entries = snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Partial<Entry> & { card_type_ids?: string[] }),
  }))
  const cardTypes = await fetchCardTypesByIds(db, entries.flatMap((e) => e.card_type_ids || []))
  const ctById = new Map(cardTypes.map((ct) => [ct.id, ct]))

  const jobs = entries.map((entry) => {
    let entryCardTypes = (entry.card_type_ids || [])
      .map((id) => ctById.get(id))
      .filter((ct): ct is CardTypeItem => !!ct)
    // 旧挙動と同じ fallback: 有効な card type がない → front_to_back を使用。
    if (entryCardTypes.length === 0) {
      entryCardTypes = [{ id: 'front_to_back', name: 'Front → Back', code: 'front_to_back' }]
    }
    return { entryId: entry.id, entry, cardTypes: entryCardTypes }
  })

  return NextResponse.json({ jobs })
})

const resultsSchema = z.object({
  results: z.array(
    z.object({
      entryId: z.string(),
      noteIds: z.array(z.number()),
    }),
  ),
})

/**
 * POST — CLIENT が Anki での note 作成結果を報告し、server が entry を `synced` に更新。
 * 現在の user が所有する entry のみ update (ownership check — multi-user isolation)。
 */
export const POST = withAuth(async (request, _ctx, uid) => {
  try {
    const parsed = resultsSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 })
    }
    const { results } = parsed.data
    if (results.length === 0) {
      return NextResponse.json({ synced: 0, failed: 0 })
    }

    // allSettled: 1 entry の異常 (GET と POST の間に削除された等) が batch 全体を fail させない。
    const db = getAdminDb()
    const settled = await Promise.allSettled(
      results.map(async (r) => {
        const ref = db.collection('entries').doc(r.entryId)
        const snap = await ref.get()
        if (!snap.exists || snap.data()?.user_id !== uid) {
          throw new Error(`Entry ${r.entryId} not found or not owned by user`)
        }
        await ref.update({
          status: 'synced',
          anki_note_ids: r.noteIds,
          updated_at: new Date(),
        })
      }),
    )
    const synced = settled.filter((s) => s.status === 'fulfilled').length
    const failed = settled.length - synced

    return NextResponse.json({ synced, failed })
  } catch (error) {
    console.error('Sync persist error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
})
