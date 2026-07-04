import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminDb } from '@/lib/firebase-admin'
import type { Entry, CardTemplate } from '@/types'

interface SyncCardType {
  id: string
  name: string
  code?: string
  template?: CardTemplate
}

/**
 * GET — trả các entry `reviewed` kèm card_types (có template) để CLIENT tự buildNotes
 * và tạo trong Anki. Server KHÔNG gọi AnkiConnect (chạy được trên Vercel).
 */
export async function GET() {
  const db = getAdminDb()

  const snapshot = await db.collection('entries').where('status', '==', 'reviewed').get()
  if (snapshot.empty) {
    return NextResponse.json({ jobs: [] })
  }

  // Gom mọi card_type_id cần dùng, fetch 1 lượt (tránh Firestore trong loop).
  const entries = snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Partial<Entry> & { card_type_ids?: string[] }),
  }))
  const neededIds = [...new Set(entries.flatMap((e) => e.card_type_ids || []))]
  const ctSnaps = await Promise.all(neededIds.map((id) => db.collection('card_types').doc(id).get()))
  const ctById = new Map<string, SyncCardType>()
  ctSnaps.forEach((s) => {
    if (!s.exists) return
    const data = s.data() as { name?: string; code?: string; template?: CardTemplate }
    ctById.set(s.id, { id: s.id, name: data.name || s.id, code: data.code, template: data.template })
  })

  const jobs = entries.map((entry) => {
    let cardTypes = (entry.card_type_ids || [])
      .map((id) => ctById.get(id))
      .filter((ct): ct is SyncCardType => !!ct)
    // Fallback giống hành vi cũ: không có card type hợp lệ → dùng front_to_back.
    if (cardTypes.length === 0) {
      cardTypes = [{ id: 'front_to_back', name: 'Front → Back', code: 'front_to_back' }]
    }
    return { entryId: entry.id, entry, cardTypes }
  })

  return NextResponse.json({ jobs })
}

const resultsSchema = z.object({
  results: z.array(
    z.object({
      entryId: z.string(),
      noteIds: z.array(z.number()),
    }),
  ),
})

/**
 * POST — CLIENT báo kết quả tạo note trong Anki; server cập nhật entry sang `synced`.
 */
export async function POST(request: Request) {
  try {
    const parsed = resultsSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', issues: parsed.error.issues }, { status: 400 })
    }
    const { results } = parsed.data
    if (results.length === 0) {
      return NextResponse.json({ synced: 0 })
    }

    const db = getAdminDb()
    await Promise.all(
      results.map((r) =>
        db.collection('entries').doc(r.entryId).update({
          status: 'synced',
          anki_note_ids: r.noteIds,
          updated_at: new Date(),
        }),
      ),
    )

    return NextResponse.json({ synced: results.length })
  } catch (error) {
    console.error('Sync persist error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
