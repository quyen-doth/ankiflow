import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import type { Entry, CardTemplate } from '@/types'

interface ResyncBody {
  formType?: string
  deckName?: string
  cardTypeId?: string
}

interface RegenCardType {
  id: string
  name: string
  code?: string
  template?: CardTemplate
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
export async function POST(request: Request) {
  try {
    const { formType, deckName, cardTypeId }: ResyncBody = await request.json().catch(() => ({}))
    const db = getAdminDb()

    // Lấy entry đã export, lọc trong bộ nhớ (tránh composite index).
    const snapshot = await db.collection('entries').where('status', '==', 'synced').get()
    const entries: EntryDoc[] = snapshot.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<EntryDoc, 'id'>) }))
      .filter((e) => Array.isArray(e.anki_note_ids) && e.anki_note_ids.length > 0)
      .filter((e) => !deckName || e.anki_deck === deckName)
      .filter((e) => !formType || e.form_type === formType)
      .filter((e) => !cardTypeId || (e.card_type_ids || []).includes(cardTypeId))

    if (entries.length === 0) {
      return NextResponse.json({ entries: [], cardTypes: [] })
    }

    // Fetch 1 lượt mọi card type cần dùng (kèm template).
    const neededIds = [...new Set(entries.flatMap((e) => e.card_type_ids || []))]
    const ctSnaps = await Promise.all(neededIds.map((id) => db.collection('card_types').doc(id).get()))
    const cardTypes: RegenCardType[] = ctSnaps
      .filter((s) => s.exists)
      .map((s) => {
        const data = s.data() as { name?: string; code?: string; template?: CardTemplate }
        return { id: s.id, name: data.name || s.id, code: data.code, template: data.template }
      })

    return NextResponse.json({ entries, cardTypes })
  } catch (error) {
    console.error('Resync data error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
