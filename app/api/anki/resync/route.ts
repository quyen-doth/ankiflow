import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { withAuth } from '@/lib/auth-guard'
import { fetchCardTypesByIds } from '@/lib/firestore-helpers'
import type { Entry } from '@/types'

interface ResyncBody {
  formType?: string
  deckName?: string
  cardTypeId?: string
}

type EntryDoc = Partial<Entry> & {
  id: string
  anki_note_ids?: number[]
  card_type_ids?: string[]
}

/**
 * POST — synced 済み entry (filter 適用) + card_types (template 込み) を返し、CLIENT が
 * Front/Back を再生成して Anki 側で `updateNoteFields` する。Server は Anki に触れない
 * (Vercel で動作可能)。Resync は Anki の note のみ変更し、Firestore へは書き戻さない。
 */
export const POST = withAuth(async (request, _ctx, uid) => {
  try {
    const { formType, deckName, cardTypeId }: ResyncBody = await request.json().catch(() => ({}))
    const db = getAdminDb()

    // 該当 USER の export 済み entry を取得し、メモリ内で filter (composite index 回避)。
    // audio_url/audio_example_url は strip (base64 data-URL は ~1MB/entry になり得る):
    // resync は Anki の notesInfo にある既存 media を使うため audio 不要 → 数 MB の response を回避。
    const snapshot = await db
      .collection('entries')
      .where('user_id', '==', uid)
      .where('status', '==', 'synced')
      .get()
    const entries: EntryDoc[] = snapshot.docs
      .map((d) => {
        const { audio_url: _audio, audio_example_url: _audioEx, ...rest } = d.data() as Omit<EntryDoc, 'id'>
        void _audio
        void _audioEx
        return { id: d.id, ...rest }
      })
      .filter((e) => Array.isArray(e.anki_note_ids) && e.anki_note_ids.length > 0)
      .filter((e) => !deckName || e.anki_deck === deckName)
      .filter((e) => !formType || e.form_type === formType)
      .filter((e) => !cardTypeId || (e.card_type_ids || []).includes(cardTypeId))

    if (entries.length === 0) {
      return NextResponse.json({ entries: [], cardTypes: [] })
    }

    // 必要な card type を template 込みで一括 fetch。
    const cardTypes = await fetchCardTypesByIds(db, entries.flatMap((e) => e.card_type_ids || []))

    return NextResponse.json({ entries, cardTypes })
  } catch (error) {
    console.error('Resync data error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
})
