import { NextResponse } from 'next/server';
import { generateAudioBase64, storeAudioInAnki } from '@/lib/audio-service';

export async function POST(request: Request) {
  let base64Audio = '';
  let parsedFilename = '';

  try {
    const body = await request.json();
    const { text, language, filename } = body;

    if (!text || !language || !filename) {
      return NextResponse.json({ error: 'Missing text, language, or filename' }, { status: 400 });
    }
    
    parsedFilename = filename;
    
    // 1. Generate base64
    base64Audio = await generateAudioBase64(text, language);
  } catch (error) {
    console.error('TTS Generate Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  try {
    // 2. Store in Anki
    const storedFilename = await storeAudioInAnki(parsedFilename, base64Audio);
    return NextResponse.json({ success: true, filename: storedFilename });
  } catch (error) {
    console.error('Anki Store Error:', error);
    return NextResponse.json({ 
      success: false, 
      stage: 'store', 
      base64: base64Audio, 
      filename: parsedFilename, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}
