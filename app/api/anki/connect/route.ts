import { NextResponse } from 'next/server';
import { flashcardService } from '@/lib/flashcard-service';

export async function GET() {
  try {
    const isConnected = await (await flashcardService.ping()).connected;
    
    if (isConnected) {
      return NextResponse.json({
        status: 'connected',
        version: 6,
      });
    } else {
      return NextResponse.json({
        status: 'disconnected',
        error: 'Cannot connect to Anki. Please ensure Anki is running and AnkiConnect is installed.',
      }, { status: 503 });
    }
  } catch (error) {
    return NextResponse.json({
      status: 'disconnected',
      error: (error as Error).message,
    }, { status: 500 });
  }
}
