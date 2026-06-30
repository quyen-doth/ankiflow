import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { LOCAL_USER_ID } from '@/lib/constants'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { entryData } = body

    if (!entryData) {
      return NextResponse.json({ error: 'Missing entryData' }, { status: 400 })
    }

    const db = getAdminDb()

    const newEntry = {
      ...entryData,
      user_id: LOCAL_USER_ID,
      status: 'reviewed',
      anki_note_ids: [],
      created_at: new Date(),
      updated_at: new Date(),
    }

    const docRef = await db.collection('entries').add(newEntry)

    return NextResponse.json({ success: true, entryId: docRef.id })
  } catch (error) {
    console.error('Save entry error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
