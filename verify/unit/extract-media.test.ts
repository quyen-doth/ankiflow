import { describe, expect, it } from 'vitest'
import { extractMedia } from '@/lib/anki/extractMedia'

describe('extractMedia', () => {
  it('[sound:...] から audio を抽出', () => {
    expect(extractMedia('meaning [sound:ankiflow_hello.mp3]')).toEqual({
      audioFilename: 'ankiflow_hello.mp3',
    })
  })

  it('例文 audio だけなら専用 prefix で分類する', () => {
    expect(extractMedia('[sound:ankiflow_audio_ex_hello.mp3]')).toEqual({
      audioExampleFilename: 'ankiflow_audio_ex_hello.mp3',
    })
  })

  it('通常 audio と例文 audio の両方を抽出する', () => {
    expect(extractMedia(
      '[sound:ankiflow_hello.mp3] [sound:ankiflow_audio_ex_hello.mp3]',
    )).toEqual({
      audioFilename: 'ankiflow_hello.mp3',
      audioExampleFilename: 'ankiflow_audio_ex_hello.mp3',
    })
  })

  it('例文 audio が先でも通常 audio と取り違えない', () => {
    expect(extractMedia(
      '[sound:ankiflow_audio_ex_hello.mp3] [sound:ankiflow_hello.mp3]',
    )).toEqual({
      audioFilename: 'ankiflow_hello.mp3',
      audioExampleFilename: 'ankiflow_audio_ex_hello.mp3',
    })
  })

  it('Anki メディア画像を抽出 (素のファイル名)', () => {
    const html = '<div class="media"><img src="ankiflow_img_hello.png" alt=""></div>'
    expect(extractMedia(html)).toEqual({ imageFilename: 'ankiflow_img_hello.png' })
  })

  it('http URL の画像はスキップ (buildNotes が image_url から自動的に再埋め込み)', () => {
    const html = '<img src="https://images.unsplash.com/photo-x">'
    expect(extractMedia(html)).toEqual({})
  })

  it('data URL の画像はスキップ', () => {
    expect(extractMedia('<img src="data:image/png;base64,AAAA">')).toEqual({})
  })

  it('同じ HTML 内で audio と画像の両方を取得', () => {
    const html = '<img src="ankiflow_img_x.jpg"> word [sound:ankiflow_x.mp3]'
    expect(extractMedia(html)).toEqual({
      audioFilename: 'ankiflow_x.mp3',
      imageFilename: 'ankiflow_img_x.jpg',
    })
  })

  it('メディアがない → 空の object', () => {
    expect(extractMedia('<div class="word">hello</div>')).toEqual({})
  })
})
