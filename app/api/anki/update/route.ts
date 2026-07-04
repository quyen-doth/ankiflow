import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import type { Entry, CardTemplate } from '@/types'

interface RegenCardType {
  id: string
  name: string
  code?: string
  template?: CardTemplate
}

/**
 * PUT — cập nhật entry trong Firestore, rồi TRẢ VỀ dữ liệu để CLIENT tự sinh lại note
 * trong Anki (browser → AnkiConnect). Server KHÔNG đụng Anki (chạy được trên Vercel).
 * Việc lưu Firestore luôn thành công dù Anki offline — client regen là best-effort.
 */
export async function PUT(request: Request) {
  try {
    const { entryId, updates } = await request.json()

    if (!entryId) {
      return NextResponse.json({ error: 'Missing entryId' }, { status: 400 })
    }

    const db = getAdminDb()

    if (updates && Object.keys(updates).length > 0) {
      await db.collection('entries').doc(entryId).update({
        ...updates,
        updated_at: new Date(),
      })
    }

    const snap = await db.collection('entries').doc(entryId).get()
    if (!snap.exists) {
      return NextResponse.json({ success: true, entry: null, cardTypes: [], noteIds: [] })
    }

    const entry = {
      id: snap.id,
      ...(snap.data() as Partial<Entry> & { anki_note_ids?: number[]; card_type_ids?: string[] }),
    }
    const noteIds = entry.anki_note_ids || []

    let cardTypes: RegenCardType[] = []
    if (noteIds.length > 0) {
      const ctIds = [...new Set(entry.card_type_ids || [])]
      const ctSnaps = await Promise.all(ctIds.map((id) => db.collection('card_types').doc(id).get()))
      cardTypes = ctSnaps
        .filter((s) => s.exists)
        .map((s) => {
          const data = s.data() as { name?: string; code?: string; template?: CardTemplate }
          return { id: s.id, name: data.name || s.id, code: data.code, template: data.template }
        })
    }

    return NextResponse.json({ success: true, entry, cardTypes, noteIds })
  } catch (error) {
    console.error('Update entry error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
