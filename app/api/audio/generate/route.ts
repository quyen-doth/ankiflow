import { NextResponse } from 'next/server';
import { generateAudioBase64 } from '@/lib/audio-service';
import { withAuth } from '@/lib/auth-guard';
import { getAdminDb } from '@/lib/firebase-admin';
import { GLOBAL_SETTINGS_DOC_ID } from '@/lib/constants';
import { canonicalizeLanguageCode } from '@/lib/studyLanguages';

/** Cổng chi phí: admin có thể tắt TTS cho mọi user qua /api/admin/global-config. Fail-open nếu doc chưa seed. */
async function isTtsAvailable(): Promise<boolean> {
  try {
    const snap = await getAdminDb().collection('settings').doc(GLOBAL_SETTINGS_DOC_ID).get();
    const data = snap.data();
    return (data?.tts_available as boolean | undefined) ?? true;
  } catch {
    return true;
  }
}

export const POST = withAuth(async (request) => {
  try {
    if (!(await isTtsAvailable())) {
      return NextResponse.json({ error: 'Text-to-speech is disabled by the administrator' }, { status: 403 });
    }

    const body = await request.json();
    const { text, language, filename } = body;

    if (
      typeof text !== 'string' || !text.trim()
      || typeof language !== 'string' || !language.trim()
      || typeof filename !== 'string' || !filename.trim()
    ) {
      return NextResponse.json({ error: 'Missing text, language, or filename' }, { status: 400 });
    }

    const languageCode = canonicalizeLanguageCode(language);
    if (!languageCode) {
      return NextResponse.json({ error: 'language must be a valid BCP 47 code' }, { status: 400 });
    }

    const base64Audio = await generateAudioBase64(text, languageCode);

    return NextResponse.json({ success: true, base64: base64Audio, filename });
  } catch (error) {
    console.error('Audio Generate Error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
})
