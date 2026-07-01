import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { flashcardService } from '@/lib/flashcard-service'
import { buildNotes } from '@/lib/buildNotes'
import type { Entry, CardTemplate } from '@/types'

export async function POST() {
  const db = getAdminDb()

  const snapshot = await db
    .collection('entries')
    .where('status', '==', 'reviewed')
    .get()

  if (snapshot.empty) {
    return NextResponse.json({ synced: 0, failed: 0, errors: [] })
  }

  const models = await flashcardService.getModelNames()
  if (!models.includes('AnkiFlow-Basic')) {
    await flashcardService.createModel({
      modelName: 'AnkiFlow-Basic',
      inOrderFields: ['Front', 'Back'],
      css: `.card { font-family: 'Inter', sans-serif; font-size: 20px; text-align: center; }`,
      cardTemplates: [
        { Name: 'Card 1', Front: '{{Front}}', Back: '{{FrontSide}}<hr id="answer">{{Back}}' },
      ],
    })
  }

  let synced = 0
  const failed: string[] = []
  const errors: string[] = []

  for (const docSnap of snapshot.docs) {
    const entry = docSnap.data() as Partial<Entry> & { card_type_ids?: string[] }
    const entryId = docSnap.id

    try {
      const cardTypeIds = entry.card_type_ids || []
      let cardTypes: { id: string; name: string; code?: string; template?: CardTemplate }[] = []
      if (cardTypeIds.length > 0) {
        const ctSnaps = await Promise.all(
          cardTypeIds.map(id => db.collection('card_types').doc(id).get()),
        )
        cardTypes = ctSnaps
          .filter(s => s.exists)
          .map(s => ({ id: s.id, ...(s.data() as { name: string; code?: string; template?: CardTemplate }) }))
      }

      if (cardTypes.length === 0) {
        cardTypes = [{ id: 'front_to_back', name: 'Front → Back', code: 'front_to_back' }]
      }

      const deckName = entry.anki_deck || 'Default'
      await flashcardService.createDeck(deckName)

      const notes = buildNotes(entry, cardTypes)
      const noteIds = await flashcardService.addNotes(notes)

      await db.collection('entries').doc(entryId).update({
        status: 'synced',
        anki_note_ids: noteIds,
        updated_at: new Date(),
      })

      synced++
    } catch (err) {
      failed.push(entryId)
      errors.push(`${entryId}: ${(err as Error).message}`)
    }
  }

  return NextResponse.json({ synced, failed: failed.length, errors })
}
