import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TEMPLATES,
  getFieldLabel,
  renderSide,
  resolveCardTemplate,
  selectedCardTypesUseSource,
} from '@/lib/anki/renderCard'
import type { CardTemplateSource } from '@/lib/anki/renderCard'
import { cardTemplateSchema, parseCustomFieldSource } from '@/lib/anki/cardFieldSource'
import { ANKI_CARD_CSS } from '@/lib/anki/model'
import type { Entry } from '@/types'

const ENTRY: Partial<Entry> = {
  word: 'hello',
  ipa: 'həˈloʊ',
  meaning_vi: 'こんにちは',
  word_type: 'interjection',
  example_sentence: 'Hello, how are you?',
  example_translation: 'こんにちは、お元気ですか？',
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

  it('audio_example は専用 filename を [sound:] としてレンダリングする', () => {
    const html = renderSide(['audio_example'], ENTRY, {
      side: 'back',
      audioExampleFilename: 'ankiflow_audio_ex_hello.mp3',
    })
    expect(html).toContain('[sound:ankiflow_audio_ex_hello.mp3]')
    expect(html).not.toContain('audio-chip')
  })

  it('audio_example preview は専用 chip label を表示する', () => {
    const html = renderSide(['audio_example'], ENTRY, {
      side: 'back',
      audioExampleFilename: 'preview',
      audioIcon: true,
    })
    expect(html).toContain('🔊 Example audio')
    expect(html).not.toContain('[sound:')
  })

  it('audioExampleFilename がない audio_example block は非表示', () => {
    expect(renderSide(['audio_example'], ENTRY, { side: 'back' })).toBe('')
  })
})

describe('selectedCardTypesUseSource', () => {
  const cardTypes: CardTemplateSource[] = [
    {
      id: 'main-only',
      template: { front: ['word'], back: ['audio'] },
    },
    {
      id: 'with-example',
      template: { front: ['word'], back: ['audio_example'] },
    },
  ]

  it('選択中 template に source がある場合だけ true', () => {
    expect(selectedCardTypesUseSource(cardTypes, ['with-example'], 'audio_example')).toBe(true)
    expect(selectedCardTypesUseSource(cardTypes, ['main-only'], 'audio_example')).toBe(false)
  })

  it('source を持つ未選択 template は generation gate に含めない', () => {
    expect(selectedCardTypesUseSource(cardTypes, [], 'audio_example')).toBe(false)
    expect(selectedCardTypesUseSource(cardTypes, ['missing'], 'audio_example')).toBe(false)
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

  it('legacy alias を canonical block としてレンダリングする', () => {
    const html = renderSide(
      ['meaning', 'word_type', 'example'],
      {
        definition_vi: 'Legacy definition',
        word_type_vi: 'Legacy type',
        example_usage: 'Legacy example',
      } as Partial<Entry>,
      { side: 'back' },
    )

    expect(html).toContain('Legacy definition')
    expect(html).toContain('Legacy type')
    expect(html).toContain('Legacy example')
  })

  it('空白だけの builtin value は content としてレンダリングしない', () => {
    expect(renderSide(
      ['word', 'meaning'],
      { word: '   ', meaning_vi: '\n\t' },
      { side: 'front' },
    )).toBe('')
  })
})

describe('renderSide — custom fields', () => {
  it('string 値を custom field block としてレンダリングする', () => {
    const html = renderSide(
      ['custom:phon_the'],
      { ...ENTRY, phon_the: '您好' } as Partial<Entry>,
      { side: 'back' },
    )

    expect(html).toBe('<div class="back"><div class="custom-field custom-phon_the">您好</div></div>')
  })

  it('string[] を shared CSS で見える改行としてレンダリングする', () => {
    const html = renderSide(
      ['custom:usage_notes'],
      { ...ENTRY, usage_notes: ['formal', 'written'] } as Partial<Entry>,
      { side: 'back' },
    )

    expect(html).toContain('formal\nwritten')
    expect(ANKI_CARD_CSS).toMatch(/\.custom-field\s*\{[^}]*white-space:\s*pre-line;/)
  })

  it('値がない、または string/string[] 以外なら block を表示しない', () => {
    expect(renderSide(['custom:phon_the'], ENTRY, { side: 'back' })).toBe('')
    expect(renderSide(
      ['custom:phon_the'],
      { ...ENTRY, phon_the: 42 } as Partial<Entry>,
      { side: 'back' },
    )).toBe('')
    expect(renderSide(
      ['custom:phon_the'],
      { ...ENTRY, phon_the: ['valid', 42] } as Partial<Entry>,
      { side: 'back' },
    )).toBe('')
  })

  it('空白だけの custom string/string[] は表示しない', () => {
    expect(renderSide(
      ['custom:phon_the'],
      { phon_the: '   ' } as Partial<Entry>,
      { side: 'back' },
    )).toBe('')
    expect(renderSide(
      ['custom:usage_notes'],
      { usage_notes: [' ', '\n'] } as Partial<Entry>,
      { side: 'back' },
    )).toBe('')
  })
})

describe('card field source helpers', () => {
  it('custom source key を検証して parse する', () => {
    expect(parseCustomFieldSource('custom:phon_the')).toBe('phon_the')
    expect(parseCustomFieldSource('word')).toBeNull()
    expect(parseCustomFieldSource('custom:')).toBeNull()
    expect(parseCustomFieldSource('custom:UPPER')).toBeNull()
  })

  it('builtin/custom label を解決する', () => {
    expect(getFieldLabel('meaning')).toBe('Meaning')
    expect(getFieldLabel('audio_example')).toBe('Example audio')
    expect(getFieldLabel('custom:phon_the')).toBe('Phon the')
    expect(getFieldLabel('custom:phon_the', { phon_the: 'Traditional form' })).toBe('Traditional form')
  })

  it.each(['custom:', 'custom:UPPER', 'unknown'])('不正 source %s を template schema が拒否する', source => {
    expect(cardTemplateSchema.safeParse({ front: ['word'], back: [source] }).success).toBe(false)
  })

  it('正しい builtin/custom source を template schema が受け入れる', () => {
    expect(cardTemplateSchema.safeParse({
      front: ['word'],
      back: ['meaning', 'audio_example', 'custom:phon_the'],
    }).success).toBe(true)
  })
})

describe('DEFAULT_TEMPLATES — backward-compatible golden output', () => {
  const goldenEntry: Partial<Entry> = {
    ...ENTRY,
    han_viet: 'hô lô',
    collocations: ['say hello', 'hello world'],
  }
  const options = { audioFilename: 'voice.mp3', imageFilename: 'image.jpg' }
  const block = {
    word: '<div class="word">hello</div>',
    reading: '<div class="reading">həˈloʊ</div>',
    han_viet: '<div class="han-viet">hô lô</div>',
    meaning: '<div class="meaning">こんにちは</div>',
    word_type: '<span class="pos">interjection</span>',
    example: '<div class="example">Hello, how are you?</div>',
    example_blank: '<div class="example"><b class="cloze">______</b>, how are you?</div>',
    translation: '<div class="translation">こんにちは、お元気ですか？</div>',
    collocations: '<ul class="collocations"><li>say hello</li><li>hello world</li></ul>',
    image: '<div class="media"><img src="image.jpg" alt=""></div>',
    audio: '[sound:voice.mp3]',
  }
  const side = (name: 'front' | 'back', parts: string[]) => (
    `<div class="${name}">${parts.join('\n')}</div>`
  )
  const expected: Record<string, { front: string; back: string }> = {
    word_to_meaning: {
      front: side('front', [block.word, block.reading, block.han_viet]),
      back: side('back', [block.meaning, block.word_type, block.image, block.audio]),
    },
    meaning_to_word: {
      front: side('front', [block.meaning]),
      back: side('back', [block.word, block.reading, block.han_viet, block.audio]),
    },
    audio_to_word: {
      front: side('front', [block.audio]),
      back: side('back', [block.word, block.reading, block.han_viet, block.meaning]),
    },
    image_to_word: {
      front: side('front', [block.image]),
      back: side('back', [block.word, block.reading, block.han_viet, block.meaning, block.audio]),
    },
    fill_in_blank: {
      front: side('front', [block.example_blank]),
      back: side('back', [block.example, block.translation, block.word, block.audio]),
    },
    reading_to_word: {
      front: side('front', [block.reading]),
      back: side('back', [block.word, block.han_viet, block.meaning, block.audio]),
    },
    word_to_reading: {
      front: side('front', [block.word, block.han_viet]),
      back: side('back', [block.reading, block.meaning, block.audio]),
    },
    concept_to_def: {
      front: side('front', [block.word]),
      back: side('back', [block.meaning, block.example, block.translation, block.audio]),
    },
    def_to_concept: {
      front: side('front', [block.meaning]),
      back: side('back', [block.word, block.example, block.audio]),
    },
    front_to_back: {
      front: side('front', [block.word]),
      back: side('back', [block.meaning, block.example, block.translation, block.audio]),
    },
  }

  it('全 default template の builtin HTML を変更しない', () => {
    const rendered = Object.fromEntries(Object.entries(DEFAULT_TEMPLATES).map(([code, template]) => [
      code,
      {
        front: renderSide(template.front, goldenEntry, { ...options, side: 'front' }),
        back: renderSide(template.back, goldenEntry, { ...options, side: 'back' }),
      },
    ]))

    expect(rendered).toEqual(expected)
  })
})

describe('resolveCardTemplate — safe fallback', () => {
  it('prototype key の code を own template として扱わない', () => {
    expect(resolveCardTemplate({
      id: 'legacy-constructor',
      code: 'constructor',
    })).toBe(DEFAULT_TEMPLATES.word_to_meaning)
  })

  it('破損した persisted template は default へ fallback する', () => {
    expect(resolveCardTemplate({
      id: 'broken',
      code: 'meaning_to_word',
      template: { front: [], back: ['word'] },
    })).toBe(DEFAULT_TEMPLATES.meaning_to_word)
  })
})
