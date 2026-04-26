import { NextResponse } from 'next/server';
import { flashcardService } from '@/lib/flashcard-service';
import { getAdminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { notes, entryData } = body;

    if (!notes || !Array.isArray(notes)) {
      return NextResponse.json({ error: 'Missing notes array' }, { status: 400 });
    }

    // 1. Tạo notes trong Anki
    const noteIds = await flashcardService.addNotes(notes);

    // 2. Lưu vào Firestore nếu có entryData
    let entryId = null;
    if (entryData) {
      const db = getAdminDb();
      const validNoteIds = noteIds.filter(id => id !== null) as number[];
      
      const newEntry = {
        ...entryData,
        anki_note_ids: validNoteIds,
        created_at: new Date(), // Firebase Admin sẽ tự động convert Date sang Timestamp
        updated_at: new Date(),
        status: 'synced'
      };

      const docRef = await db.collection('entries').add(newEntry);
      entryId = docRef.id;
    }

    return NextResponse.json({ success: true, noteIds, entryId });
  } catch (error) {
    console.error('Create Anki Notes Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
