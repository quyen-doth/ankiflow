import { LanguageType } from '@/types'
import { canonicalizeLanguageCode } from '@/lib/studyLanguages'
import { TextToSpeechClient } from "@google-cloud/text-to-speech";

let client: TextToSpeechClient;


if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    client = new TextToSpeechClient();
} else {
  console.warn("GOOGLE_APPLICATION_CREDENTIALS not found. TTS will not work.");
}

export interface TtsVoice {
  languageCode: string
  name?: string
}

const DEFAULT_VOICES: Record<LanguageType, TtsVoice> = {
  [LanguageType.ENGLISH]: { languageCode: 'en-US', name: 'en-US-Wavenet-F' },
  [LanguageType.CHINESE]: { languageCode: 'cmn-CN', name: 'cmn-CN-Wavenet-A' },
  [LanguageType.JAPANESE]: { languageCode: 'ja-JP', name: 'ja-JP-Wavenet-A' },
}

// Google Cloud TTS has no voices under zh-*: Mandarin lives under cmn-*, Cantonese under yue-*.
const CHINESE_TTS_LOCALES: Record<string, string> = {
  'zh-TW': 'cmn-TW',
  'zh-HK': 'yue-HK',
}

/** Resolve a Google TTS locale without silently falling back to English. */
export function resolveTtsVoice(language: string): TtsVoice {
  const canonical = canonicalizeLanguageCode(language)
  if (!canonical) throw new Error(`Unsupported TTS language code: ${language}`)

  if (canonical in DEFAULT_VOICES) {
    return DEFAULT_VOICES[canonical as LanguageType]
  }

  if (new Intl.Locale(canonical).language === 'zh') {
    return { languageCode: CHINESE_TTS_LOCALES[canonical] ?? DEFAULT_VOICES[LanguageType.CHINESE].languageCode }
  }

  const locale = new Intl.Locale(canonical)
  const maximized = locale.maximize()
  const languageCode = locale.region
    ? locale.baseName
    : maximized.region
      ? `${locale.baseName}-${maximized.region}`
      : locale.baseName
  return { languageCode }
}

export const generateAudio = async (text: string, language: string): Promise<Buffer> => {
  if (!client) {
    throw new Error("TextToSpeechClient is not initialized. Please check GOOGLE_APPLICATION_CREDENTIALS.");
  }

  const voice = resolveTtsVoice(language)

  const request = {
    input: { text },
    voice,
    audioConfig: { audioEncoding: "MP3" as const },
  };

  const [response] = await client.synthesizeSpeech(request);
  
  if (!response.audioContent) {
    throw new Error("Failed to generate audio content");
  }

  // response.audioContent can be a string or Uint8Array. 
  // TextToSpeechClient synthesizes to Uint8Array by default.
  return Buffer.from(response.audioContent);
};
