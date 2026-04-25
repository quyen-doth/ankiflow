import { NextResponse } from 'next/server';
import { generateAudio } from '@/lib/tts';
import { ankiConnect } from '@/lib/anki-connect';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, language, filename } = body;

    if (!text || !language || !filename) {
      return NextResponse.json({ error: 'Missing text, language, or filename' }, { status: 400 });
    }

    // 1. Generate audio Buffer
    const audioBuffer = await generateAudio(text, language);
    
    // 2. Convert to base64
    const base64Audio = audioBuffer.toString('base64');
    
    // 3. Store in Anki
    const storedFilename = await ankiConnect.storeMediaFile(filename, base64Audio);

    return NextResponse.json({ success: true, filename: storedFilename });
  } catch (error) {
    console.error('TTS Audio Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
