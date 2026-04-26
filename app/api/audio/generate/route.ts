import { NextResponse } from 'next/server';
import { generateAudioBase64 } from '@/lib/audio-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, language, filename } = body;

    if (!text || !language || !filename) {
      return NextResponse.json({ error: 'Missing text, language, or filename' }, { status: 400 });
    }

    const base64Audio = await generateAudioBase64(text, language);

    return NextResponse.json({ success: true, base64: base64Audio, filename });
  } catch (error) {
    console.error('Audio Generate Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
