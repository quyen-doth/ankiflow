import { describe, expect, it } from 'vitest'
import { parseAudioDataUrl, parseImageDataUrl } from '@/lib/anki/mediaDataUrl'

describe('mediaDataUrl', () => {
  it('有効な audio/image base64 data URL を parse する', () => {
    expect(parseAudioDataUrl('data:audio/mp3;base64,QUJD')).toEqual({
      subtype: 'mp3',
      base64: 'QUJD',
    })
    expect(parseImageDataUrl('data:image/png;base64,QQ==')).toEqual({
      subtype: 'png',
      base64: 'QQ==',
    })
  })

  it('kind 違い、空 payload、不正文字、不正長を拒否する', () => {
    expect(parseAudioDataUrl('data:image/png;base64,QUJD')).toBeNull()
    expect(parseAudioDataUrl('data:audio/mp3;base64,')).toBeNull()
    expect(parseAudioDataUrl('data:audio/mp3;base64,not base64')).toBeNull()
    expect(parseAudioDataUrl('data:audio/mp3;base64,AA=')).toBeNull()
    expect(parseImageDataUrl('data:image/png;base64,A')).toBeNull()
  })
})
