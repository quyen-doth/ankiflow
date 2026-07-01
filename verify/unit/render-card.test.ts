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
  it('mặc định (export): audio render thành [sound:filename]', () => {
    const html = renderSide(['audio'], ENTRY, { side: 'back', audioFilename: 'a.mp3' })
    expect(html).toContain('[sound:a.mp3]')
    expect(html).not.toContain('audio-chip')
  })

  it('audioIcon (preview): audio render thành chip, KHÔNG [sound:]', () => {
    const html = renderSide(['audio'], ENTRY, { side: 'back', audioFilename: 'preview', audioIcon: true })
    expect(html).toContain('audio-chip')
    expect(html).not.toContain('[sound:')
  })

  it('audioIcon nhưng không có audioFilename → block ẩn (rỗng)', () => {
    const html = renderSide(['audio'], ENTRY, { side: 'back', audioIcon: true })
    expect(html).toBe('')
  })
})

describe('renderSide — core', () => {
  it('bọc đúng class mặt (front/back) và class field', () => {
    const html = renderSide(['word', 'reading'], ENTRY, { side: 'front' })
    expect(html).toContain('<div class="front">')
    expect(html).toContain('class="word"')
    expect(html).toContain('class="reading"')
  })

  it('block rỗng (thiếu dữ liệu) bị ẩn', () => {
    const html = renderSide(['word', 'collocations'], ENTRY, { side: 'front' })
    expect(html).toContain('hello')
    expect(html).not.toContain('collocations')
  })

  it('example_blank thay từ đích bằng ______', () => {
    const html = renderSide(['example_blank'], { ...ENTRY, word: 'hello' }, { side: 'front' })
    expect(html).toContain('______')
    expect(html).not.toMatch(/Hello,/)
  })

  it('không có field nào hợp lệ → trả về chuỗi rỗng', () => {
    const html = renderSide(['collocations', 'image'], ENTRY, { side: 'back' })
    expect(html).toBe('')
  })
})
