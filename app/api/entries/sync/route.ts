import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminDb } from '@/lib/firebase-admin'
import { fetchCardTypesByIds } from '@/lib/firestore-helpers'
import type { CardTypeItem } from '@/lib/buildNotes'
import type { Entry } from '@/types'

/**
 * GET — trả các entry `reviewed` kèm card_types (có template) để CLIENT tự buildNotes
 * và tạo trong Anki. Server KHÔNG gọi AnkiConnect (chạy được trên Vercel).
 * Lưu ý: entry giữ nguyên audio_url/image_url (data-URL) — client cần chúng để
 * storeMediaFile vào Anki media trước khi addNotes (createNotesForEntry).
 */
export async function GET() {
  const db = getAdminDb()

  const snapshot = await db.collection('entries').where('status', '==', 'reviewed').get()
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
    // Fallback giống hành vi cũ: không có card type hợp lệ → dùng front_to_back.
    if (entryCardTypes.length === 0) {
      entryCardTypes = [{ id: 'front_to_back', name: 'Front → Back', code: 'front_to_back' }]
    }
    return { entryId: entry.id, entry, cardTypes: entryCardTypes }
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
      return NextResponse.json({ synced: 0, failed: 0 })
    }

    // allSettled: 1 entry hỏng (vd bị xóa giữa GET và POST) không làm fail cả batch.
    const db = getAdminDb()
    const settled = await Promise.allSettled(
      results.map((r) =>
        db.collection('entries').doc(r.entryId).update({
          status: 'synced',
          anki_note_ids: r.noteIds,
          updated_at: new Date(),
        }),
      ),
    )
    const synced = settled.filter((s) => s.status === 'fulfilled').length
    const failed = settled.length - synced

    return NextResponse.json({ synced, failed })
  } catch (error) {
    console.error('Sync persist error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
