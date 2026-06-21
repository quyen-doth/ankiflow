import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { LOCAL_USER_ID } from '@/lib/constants'

export async function POST(request: Request) {
  try {
    const { word, language } = await request.json()

    if (!word) {
      return NextResponse.json({ error: 'Missing word' }, { status: 400 })
    }

    const db = getAdminDb()
    const wordLower = word.toLowerCase().trim()

    let query = db.collection('entries')
      .where('user_id', '==', LOCAL_USER_ID)

    if (language) {
      query = query.where('language', '==', language)
    }

    const snapshot = await query.get()

    const duplicates = snapshot.docs.filter(doc => {
      const data = doc.data()
      const entryWord = (data.word || data.term || data.title || '').toLowerCase().trim()
      return entryWord === wordLower
    }).map(doc => ({
      id: doc.id,
      word: doc.data().word || doc.data().term || doc.data().title,
      anki_deck: doc.data().anki_deck,
      status: doc.data().status,
      created_at: doc.data().created_at?.toDate?.()?.toISOString() || null,
    }))

    return NextResponse.json({
      isDuplicate: duplicates.length > 0,
      duplicates,
    })
  } catch (error) {
    console.error('Check duplicate error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
