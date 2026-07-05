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
 * POST — trả các entry đã synced (lọc theo filter) + card_types (có template) để CLIENT
 * tự sinh lại Front/Back và `updateNoteFields` trong Anki. Server KHÔNG đụng Anki
 * (chạy được trên Vercel). Resync chỉ đổi note trong Anki, không ghi lại Firestore.
 */
export const POST = withAuth(async (request, _ctx, uid) => {
  try {
    const { formType, deckName, cardTypeId }: ResyncBody = await request.json().catch(() => ({}))
    const db = getAdminDb()

    // Lấy entry đã export CỦA USER, lọc trong bộ nhớ (tránh composite index).
    // Strip audio_url/audio_example_url (base64 data-URL có thể ~1MB/entry): resync
    // giữ media cũ từ notesInfo trong Anki, không cần audio → tránh response nhiều MB.
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

    // Fetch 1 lượt mọi card type cần dùng (kèm template).
    const cardTypes = await fetchCardTypesByIds(db, entries.flatMap((e) => e.card_type_ids || []))

    return NextResponse.json({ entries, cardTypes })
  } catch (error) {
    console.error('Resync data error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
})
