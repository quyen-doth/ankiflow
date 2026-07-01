import { describe, expect, it } from 'vitest'
import { buildNotes } from '@/hooks/useAnkiExport'
import type { Entry } from '@/types'

const AUDIO_FILENAME = 'ankiflow_hello.mp3'

function makeEntry(overrides: Partial<Entry> = {}): Partial<Entry> {
  return {
    word: 'hello',
    meaning_vi: 'xin chào',
    hiragana: '',
    pinyin: '',
    ipa: 'həˈloʊ',
    word_type: 'interjection',
    example_sentence: 'Hello, how are you?',
    example_translation: 'Xin chào, bạn khỏe không?',
    anki_deck: 'Language::English::B1',
    tags: ['greeting'],
    language: 'en' as Entry['language'],
    image_url: 'https://images.unsplash.com/photo-hello',
    ...overrides,
  }
}

function makeCardType(code: string, name?: string) {
  return { id: `id_${code}`, code, name: name || code }
}

describe('buildNotes — audio in all card types', () => {
  it('word_to_meaning: audio tag appended to back', () => {
    const notes = buildNotes(makeEntry(), [makeCardType('word_to_meaning')], AUDIO_FILENAME)
    expect(notes).toHaveLength(1)
    expect(notes[0].fields.Back).toContain(`[sound:${AUDIO_FILENAME}]`)
    expect(notes[0].fields.Front).not.toContain('[sound:')
  })

  it('meaning_to_word: audio tag appended to back', () => {
    const notes = buildNotes(makeEntry(), [makeCardType('meaning_to_word')], AUDIO_FILENAME)
    expect(notes[0].fields.Back).toContain(`[sound:${AUDIO_FILENAME}]`)
    expect(notes[0].fields.Front).not.toContain('[sound:')
  })

  it('audio_to_word: audio on front, NOT on back', () => {
    const notes = buildNotes(makeEntry(), [makeCardType('audio_to_word')], AUDIO_FILENAME)
    expect(notes[0].fields.Front).toContain(`[sound:${AUDIO_FILENAME}]`)
    expect(notes[0].fields.Back).not.toContain('[sound:')
  })

  it('fill_in_blank: audio tag appended to back', () => {
    const notes = buildNotes(makeEntry(), [makeCardType('fill_in_blank')], AUDIO_FILENAME)
    expect(notes[0].fields.Back).toContain(`[sound:${AUDIO_FILENAME}]`)
  })

  it('reading_to_word: audio tag appended to back', () => {
    const notes = buildNotes(
      makeEntry({ pinyin: 'nǐ hǎo', word: '你好' }),
      [makeCardType('reading_to_word')],
      AUDIO_FILENAME,
    )
    expect(notes[0].fields.Back).toContain(`[sound:${AUDIO_FILENAME}]`)
  })

  it('concept_to_def (IT): audio tag appended to back', () => {
    const notes = buildNotes(
      makeEntry({ term: 'API', definition: 'Application Programming Interface' }),
      [makeCardType('concept_to_def')],
      AUDIO_FILENAME,
    )
    expect(notes[0].fields.Back).toContain(`[sound:${AUDIO_FILENAME}]`)
  })

  it('front_to_back (General): audio tag appended to back', () => {
    const notes = buildNotes(makeEntry(), [makeCardType('front_to_back')], AUDIO_FILENAME)
    expect(notes[0].fields.Back).toContain(`[sound:${AUDIO_FILENAME}]`)
  })

  it('no audio filename: no [sound:] tag in any card type', () => {
    const types = ['word_to_meaning', 'meaning_to_word', 'audio_to_word', 'fill_in_blank'].map(c => makeCardType(c))
    const notes = buildNotes(makeEntry(), types, undefined)
    for (const note of notes) {
      expect(note.fields.Front).not.toContain('[sound:')
      expect(note.fields.Back).not.toContain('[sound:')
    }
  })

  it('audio_to_word without filename: front is empty (no fallback)', () => {
    const notes = buildNotes(makeEntry(), [makeCardType('audio_to_word')], undefined)
    expect(notes[0].fields.Front).toBe('')
  })

  it('multiple card types: each gets correct audio placement', () => {
    const types = [
      makeCardType('word_to_meaning'),
      makeCardType('audio_to_word'),
      makeCardType('meaning_to_word'),
    ]
    const notes = buildNotes(makeEntry(), types, AUDIO_FILENAME)

    expect(notes[0].fields.Back).toContain(`[sound:${AUDIO_FILENAME}]`)
    expect(notes[0].fields.Front).not.toContain('[sound:')

    expect(notes[1].fields.Front).toContain(`[sound:${AUDIO_FILENAME}]`)
    expect(notes[1].fields.Back).not.toContain('[sound:')

    expect(notes[2].fields.Back).toContain(`[sound:${AUDIO_FILENAME}]`)
    expect(notes[2].fields.Front).not.toContain('[sound:')
  })

  it('uses AnkiFlow-Basic as model name', () => {
    const notes = buildNotes(makeEntry(), [makeCardType('word_to_meaning')])
    expect(notes[0].modelName).toBe('AnkiFlow-Basic')
  })

  it('includes language in tags', () => {
    const notes = buildNotes(makeEntry({ language: 'zh' as Entry['language'], tags: ['hsk'] }), [makeCardType('word_to_meaning')])
    expect(notes[0].tags).toContain('zh')
    expect(notes[0].tags).toContain('hsk')
  })

  it('imageFilename: nhúng <img> dùng tên file media Anki vào back', () => {
    const notes = buildNotes(makeEntry(), [makeCardType('word_to_meaning')], undefined, 'ankiflow_img_hello.png')
    expect(notes[0].fields.Back).toContain('<img src="ankiflow_img_hello.png"')
  })

  it('image_to_word: imageFilename dùng làm front', () => {
    const notes = buildNotes(makeEntry(), [makeCardType('image_to_word')], undefined, 'ankiflow_img_hello.png')
    expect(notes[0].fields.Front).toContain('<img src="ankiflow_img_hello.png"')
  })

  it('ảnh data URL không có imageFilename → không nhúng <img>', () => {
    const notes = buildNotes(
      makeEntry({ image_url: 'data:image/png;base64,AAAA' }),
      [makeCardType('word_to_meaning')],
    )
    expect(notes[0].fields.Back).not.toContain('<img')
  })

  it('ảnh URL http (Unsplash) vẫn nhúng trực tiếp khi không có imageFilename', () => {
    const notes = buildNotes(makeEntry(), [makeCardType('word_to_meaning')])
    expect(notes[0].fields.Back).toContain('<img src="https://images.unsplash.com/photo-hello"')
  })

  it('dùng template được truyền vào (admin cấu hình), KHÔNG rơi về DEFAULT_TEMPLATES', () => {
    // fill_in_blank DEFAULT back = example/translation/word/audio (không có reading/image).
    // Truyền template tùy biến có reading + image → phải xuất hiện trong output.
    const customType = {
      id: 'ct_custom',
      code: 'fill_in_blank',
      name: 'Fill in the blank',
      template: {
        front: ['example_blank' as const],
        back: ['reading' as const, 'image' as const],
      },
    }
    const notes = buildNotes(makeEntry(), [customType], undefined, 'ankiflow_img_hello.png')
    expect(notes[0].fields.Back).toContain('class="reading"')
    expect(notes[0].fields.Back).toContain('<img src="ankiflow_img_hello.png"')
    // Không có example/translation (vốn thuộc DEFAULT) trong back tùy biến này.
    expect(notes[0].fields.Back).not.toContain('class="example"')
    expect(notes[0].fields.Back).not.toContain('class="translation"')
  })
})
