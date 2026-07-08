import { describe, expect, it } from 'vitest'
import { renderSide } from '@/lib/anki/renderCard'
import type { Entry } from '@/types'

const ENTRY: Partial<Entry> = {
  word: 'hello',
  ipa: 'həˈloʊ',
  meaning_vi: 'xin chào',
  word_type: 'interjection',
  example_sentence: 'Hello, how are you?',
  example_translation: 'Xin chào, bạn khỏe không?',
}

describe('renderSide — audio rendering', () => {
  it('デフォルト (export): audio は [sound:filename] としてレンダリング', () => {
    const html = renderSide(['audio'], ENTRY, { side: 'back', audioFilename: 'a.mp3' })
    expect(html).toContain('[sound:a.mp3]')
    expect(html).not.toContain('audio-chip')
  })

  it('audioIcon (preview): audio は chip としてレンダリング、[sound:] ではない', () => {
    const html = renderSide(['audio'], ENTRY, { side: 'back', audioFilename: 'preview', audioIcon: true })
    expect(html).toContain('audio-chip')
    expect(html).not.toContain('[sound:')
  })

  it('audioIcon だが audioFilename がない → block 非表示 (空)', () => {
    const html = renderSide(['audio'], ENTRY, { side: 'back', audioIcon: true })
    expect(html).toBe('')
  })
})

describe('renderSide — han_viet', () => {
  it('値がある場合 han-viet block をレンダリング', () => {
    const html = renderSide(['word', 'han_viet'], { ...ENTRY, han_viet: 'thực' }, { side: 'front' })
    expect(html).toContain('class="han-viet"')
    expect(html).toContain('thực')
  })

  it('han_viet block が空 (値なし) は非表示', () => {
    const html = renderSide(['word', 'han_viet'], ENTRY, { side: 'front' })
    expect(html).toContain('hello')
    expect(html).not.toContain('han-viet')
  })
})

describe('renderSide — core', () => {
  it('face class (front/back) と field class を正しくラップ', () => {
    const html = renderSide(['word', 'reading'], ENTRY, { side: 'front' })
    expect(html).toContain('<div class="front">')
    expect(html).toContain('class="word"')
    expect(html).toContain('class="reading"')
  })

  it('空の block (データ不足) は非表示', () => {
    const html = renderSide(['word', 'collocations'], ENTRY, { side: 'front' })
    expect(html).toContain('hello')
    expect(html).not.toContain('collocations')
  })

  it('example_blank は対象語を ______ に置き換える', () => {
    const html = renderSide(['example_blank'], { ...ENTRY, word: 'hello' }, { side: 'front' })
    expect(html).toContain('______')
    expect(html).not.toMatch(/Hello,/)
  })

  it('有効な field がない → 空文字列を返す', () => {
    const html = renderSide(['collocations', 'image'], ENTRY, { side: 'back' })
    expect(html).toBe('')
  })
})
