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

export async function POST(request: Request) {
  try {
    const { deckName } = await request.json()
    if (!deckName) {
      return NextResponse.json({ error: 'Missing deckName' }, { status: 400 })
    }
    const deckId = await flashcardService.createDeck(deckName)
    return NextResponse.json({ success: true, deckId })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
