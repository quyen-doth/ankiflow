import { NextResponse } from 'next/server';
import { ankiConnect } from '@/lib/anki-connect';

export async function GET() {
  try {
    const decks = await ankiConnect.getDecks();
    return NextResponse.json({ decks });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
