import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { withAuth } from '@/lib/auth-guard'
import { fetchCardTypesByIds } from '@/lib/firestore-helpers'
import type { CardTypeItem } from '@/lib/buildNotes'
import type { Entry } from '@/types'
import {
  findReservedEntryQueryFields,
  reservedEntryQueryFieldsError,
} from '@/lib/entries/queryMetadata'
import { updateOwnedEntryWithQueryMetadata } from '@/lib/entries/updateEntry'

/**
 * PUT — Firestore の entry を更新し、CLIENT が Anki 側の note を再生成するための
 * データを返す (browser → AnkiConnect)。Server は Anki に触れない (Vercel で動作可能)。
 * Firestore への保存は Anki offline でも常に成功する — client の再生成は best-effort。
 */
export const PUT = withAuth(async (request, _ctx, uid) => {
  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    const { entryId, updates } = body as Record<string, unknown>

    if (typeof entryId !== 'string' || !entryId) {
      return NextResponse.json({ error: 'Missing entryId' }, { status: 400 })
    }
    if (updates !== undefined && (
      !updates || typeof updates !== 'object' || Array.isArray(updates)
    )) {
      return NextResponse.json({ error: 'Invalid updates' }, { status: 400 })
    }
    const reservedFields = findReservedEntryQueryFields(updates)
    if (reservedFields.length > 0) {
      return NextResponse.json(
        { error: reservedEntryQueryFieldsError(reservedFields) },
        { status: 400 },
      )
    }

    const db = getAdminDb()
    const entryRef = db.collection('entries').doc(entryId)

    if (updates && Object.keys(updates).length > 0) {
      const updated = await updateOwnedEntryWithQueryMetadata(
        db,
        entryRef,
        uid,
        updates as Record<string, unknown>,
      )
      if (!updated) {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
      }
    } else {
      // update がない場合も ownership を確認し、他 user の存在を漏らさない。
      const ownedSnap = await entryRef.get()
      if (!ownedSnap.exists || ownedSnap.data()?.user_id !== uid) {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
      }
    }

    const snap = await entryRef.get()
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
      cardTypes = await fetchCardTypesByIds(db, uid, entry.card_type_ids || [])
    }

    return NextResponse.json({ success: true, entry, cardTypes, noteIds })
  } catch (error) {
    console.error('Update entry error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
})
