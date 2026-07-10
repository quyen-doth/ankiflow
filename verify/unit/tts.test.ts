import { describe, expect, it } from 'vitest'
import { resolveTtsVoice } from '@/lib/tts'

describe('tts — resolveTtsVoice', () => {
  it('既存 3 言語では専用 Wavenet voice を維持', () => {
    expect(resolveTtsVoice('en')).toEqual({ languageCode: 'en-US', name: 'en-US-Wavenet-F' })
    expect(resolveTtsVoice('zh')).toEqual({ languageCode: 'cmn-CN', name: 'cmn-CN-Wavenet-A' })
    expect(resolveTtsVoice('ja')).toEqual({ languageCode: 'ja-JP', name: 'ja-JP-Wavenet-A' })
  })

  it('region 付き BCP 47 は固定 voice なしでその locale を使用', () => {
    expect(resolveTtsVoice('pt_br')).toEqual({ languageCode: 'pt-BR' })
  })

  it('region なしの言語は likely region を補完', () => {
    expect(resolveTtsVoice('fr')).toEqual({ languageCode: 'fr-FR' })
    expect(resolveTtsVoice('ko')).toEqual({ languageCode: 'ko-KR' })
  })

  it('中国語系バリアントは Google TTS が対応する cmn-*/yue-* に写像', () => {
    expect(resolveTtsVoice('zh-CN')).toEqual({ languageCode: 'cmn-CN' })
    expect(resolveTtsVoice('zh-TW')).toEqual({ languageCode: 'cmn-TW' })
    expect(resolveTtsVoice('zh-HK')).toEqual({ languageCode: 'yue-HK' })
    expect(resolveTtsVoice('zh-SG')).toEqual({ languageCode: 'cmn-CN' })
  })

  it('無効な code を英語に fallback させない', () => {
    expect(() => resolveTtsVoice('not a language')).toThrow('Unsupported TTS language code')
  })
})
