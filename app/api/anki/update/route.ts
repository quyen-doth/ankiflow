import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { withAuth } from '@/lib/auth-guard'
import { fetchCardTypesByIds } from '@/lib/firestore-helpers'
import type { CardTypeItem } from '@/lib/buildNotes'
import type { Entry } from '@/types'

/**
 * PUT — Firestore の entry を更新し、CLIENT が Anki 側の note を再生成するための
 * データを返す (browser → AnkiConnect)。Server は Anki に触れない (Vercel で動作可能)。
 * Firestore への保存は Anki offline でも常に成功する — client の再生成は best-effort。
 */
export const PUT = withAuth(async (request, _ctx, uid) => {
  try {
    const { entryId, updates } = await request.json()

    if (!entryId) {
      return NextResponse.json({ error: 'Missing entryId' }, { status: 400 })
    }

    const db = getAdminDb()

    // update 前に ownership check — 他 user の entry は編集不可 (404、存在も漏らさない)
    const ownedSnap = await db.collection('entries').doc(entryId).get()
    if (!ownedSnap.exists || ownedSnap.data()?.user_id !== uid) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }

    if (updates && Object.keys(updates).length > 0) {
      delete updates.user_id // 所有者の変更は許可しない
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
