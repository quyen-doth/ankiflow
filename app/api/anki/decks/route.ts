import { NextResponse } from 'next/server';
import { flashcardService } from '@/lib/flashcard-service';

export async function GET() {
  try {
    const decks = await flashcardService.getDecks();
    return NextResponse.json({ decks });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
