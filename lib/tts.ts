import { LanguageType } from "@/types";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";

let client: TextToSpeechClient;


if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    client = new TextToSpeechClient();
} else {
  console.warn("GOOGLE_APPLICATION_CREDENTIALS not found. TTS will not work.");
}

export const generateAudio = async (text: string, language: LanguageType | string): Promise<Buffer> => {
  if (!client) {
    throw new Error("TextToSpeechClient is not initialized. Please check GOOGLE_APPLICATION_CREDENTIALS.");
  }

  let languageCode = "en-US";
  let voiceName = "en-US-Wavenet-F";

  if (language === LanguageType.CHINESE) {
    languageCode = "zh-CN";
    voiceName = "zh-CN-Wavenet-A";
  } else if (language === LanguageType.JAPANESE) {
    languageCode = "ja-JP";
    voiceName = "ja-JP-Wavenet-A";
  } else if (language === LanguageType.ENGLISH) {
    languageCode = "en-US";
    voiceName = "en-US-Wavenet-F";
  }

  const request = {
    input: { text },
    voice: { languageCode, name: voiceName },
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
