import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { withAuth } from '@/lib/auth-guard'
import { fetchCardTypesByIds } from '@/lib/firestore-helpers'
import type { CardTypeItem } from '@/lib/buildNotes'
import type { Entry } from '@/types'

/**
 * PUT — cập nhật entry trong Firestore, rồi TRẢ VỀ dữ liệu để CLIENT tự sinh lại note
 * trong Anki (browser → AnkiConnect). Server KHÔNG đụng Anki (chạy được trên Vercel).
 * Việc lưu Firestore luôn thành công dù Anki offline — client regen là best-effort.
 */
export const PUT = withAuth(async (request, _ctx, uid) => {
  try {
    const { entryId, updates } = await request.json()

    if (!entryId) {
      return NextResponse.json({ error: 'Missing entryId' }, { status: 400 })
    }

    const db = getAdminDb()

    // Ownership check TRƯỚC khi update — không cho sửa entry của user khác (404, không lộ tồn tại)
    const ownedSnap = await db.collection('entries').doc(entryId).get()
    if (!ownedSnap.exists || ownedSnap.data()?.user_id !== uid) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    if (updates && Object.keys(updates).length > 0) {
      delete updates.user_id // không cho đổi chủ sở hữu
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

    let cardTypes: CardTypeItem[] = []
    if (noteIds.length > 0) {
      cardTypes = await fetchCardTypesByIds(db, entry.card_type_ids || [])
    }

    return NextResponse.json({ success: true, entry, cardTypes, noteIds })
  } catch (error) {
    console.error('Update entry error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
})
