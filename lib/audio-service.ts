import { generateAudio } from '@/lib/tts';
import { ankiConnect } from '@/lib/anki-connect';

export async function generateAudioBase64(text: string, language: string): Promise<string> {
  const audioBuffer = await generateAudio(text, language);
  return audioBuffer.toString('base64');
}

export async function storeAudioInAnki(filename: string, base64Audio: string): Promise<string> {
  return await ankiConnect.storeMediaFile(filename, base64Audio);
}
