import { NextResponse } from 'next/server';
import { storeAudioInAnki } from '@/lib/audio-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { base64, filename } = body;

    if (!base64 || !filename) {
      return NextResponse.json({ error: 'Missing base64 or filename' }, { status: 400 });
    }

    const storedFilename = await storeAudioInAnki(filename, base64);

    return NextResponse.json({ success: true, filename: storedFilename });
  } catch (error) {
    console.error('Audio Store Error:', error);
    const message = (error as Error).message;
    const status = message.includes('fetch failed') ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
