import { LanguageType } from '@/types'
import { canonicalizeLanguageCode } from '@/lib/studyLanguages'
import { TextToSpeechClient } from "@google-cloud/text-to-speech";

type TtsClientOptions = ConstructorParameters<typeof TextToSpeechClient>[0]

/**
 * env から TextToSpeechClient の constructor options を解決する。
 * - GOOGLE_TTS_CREDENTIALS_JSON: service account JSON の中身そのもの (serverless 用 —
 *   Vercel にはファイルシステム上の key file が存在しないため、パスではなく中身を渡す)。
 * - GOOGLE_APPLICATION_CREDENTIALS: key file へのパス (ローカル開発用 — ライブラリが自動で読む)。
 * - どちらもなければ null (TTS 無効)。
 */
export function resolveTtsClientOptions(
  env: Record<string, string | undefined> = process.env,
): TtsClientOptions | null {
  const json = env.GOOGLE_TTS_CREDENTIALS_JSON?.trim()
  if (json) {
    try {
      return { credentials: JSON.parse(json) }
    } catch {
      throw new Error('GOOGLE_TTS_CREDENTIALS_JSON is not valid JSON. Paste the full service account JSON (minified).')
    }
  }
  if (env.GOOGLE_APPLICATION_CREDENTIALS) {
    return {}
  }
  return null
}

let client: TextToSpeechClient | null | undefined

/** Lazy init — import 時ではなく最初の生成時に初期化 (env 未設定でも import が warn しない)。 */
function getTtsClient(): TextToSpeechClient | null {
  if (client === undefined) {
    const options = resolveTtsClientOptions()
    client = options === null ? null : new TextToSpeechClient(options)
  }
  return client
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
  const ttsClient = getTtsClient()
  if (!ttsClient) {
    throw new Error("Google TTS is not configured. Set GOOGLE_TTS_CREDENTIALS_JSON (service account JSON contents) or GOOGLE_APPLICATION_CREDENTIALS (key file path).");
  }

  const voice = resolveTtsVoice(language)

  const request = {
    input: { text },
    voice,
    audioConfig: { audioEncoding: "MP3" as const },
  };

  const [response] = await ttsClient.synthesizeSpeech(request);
  
  if (!response.audioContent) {
    throw new Error("Failed to generate audio content");
  }

  // response.audioContent can be a string or Uint8Array. 
  // TextToSpeechClient synthesizes to Uint8Array by default.
  return Buffer.from(response.audioContent);
};
