import { generateAudio } from '@/lib/tts';

export async function generateAudioBase64(text: string, language: string): Promise<string> {
  const audioBuffer = await generateAudio(text, language);
  return audioBuffer.toString('base64');
}
