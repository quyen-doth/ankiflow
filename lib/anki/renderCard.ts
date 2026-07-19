import {
  BUILTIN_CARD_FIELD_SOURCES,
  parseCustomFieldSource,
} from '@/lib/anki/cardFieldSource'
import type {
  BuiltinCardFieldSource,
  CardFieldSource,
  CardTemplate,
  Entry,
} from '@/types'

export { parseCustomFieldSource } from '@/lib/anki/cardFieldSource'

interface RenderOpts {
  audioFilename?: string
  imageFilename?: string
  side?: 'front' | 'back'
  /** Preview only: render audio as an icon chip instead of [sound:filename]. */
  audioIcon?: boolean
}

type FieldRenderer = {
  label: string
  getValue: (entry: Partial<Entry>, opts: RenderOpts) => string
  render: (value: string) => string
}

export const FIELD_LABELS: Record<BuiltinCardFieldSource, string> = {
  word: 'Word / Term',
  reading: 'Reading',
  han_viet: 'Sino-Vietnamese reading',
  meaning: 'Meaning',
  word_type: 'Word type',
  example: 'Example',
  example_blank: 'Fill-in-blank',
  translation: 'Translation',
  collocations: 'Collocations',
  image: 'Image',
  audio: 'Audio',
}

export const ALL_FIELD_SOURCES: BuiltinCardFieldSource[] = [...BUILTIN_CARD_FIELD_SOURCES]

const FIELD_RENDERERS: Record<BuiltinCardFieldSource, FieldRenderer> = {
  word: {
    label: 'Word / Term',
    getValue: (e) => e.word || e.term || e.title || '',
    render: (v) => `<div class="word">${v}</div>`,
  },
  reading: {
    label: 'Reading',
    getValue: (e) => e.hiragana || e.pinyin || e.ipa || '',
    render: (v) => `<div class="reading">${v}</div>`,
  },
  han_viet: {
    label: 'Sino-Vietnamese reading',
    getValue: (e) => e.han_viet || '',
    render: (v) => `<div class="han-viet">${v}</div>`,
  },
  meaning: {
    label: 'Meaning',
    getValue: (e) => e.meaning_vi || e.definition || e.content || '',
    render: (v) => `<div class="meaning">${v}</div>`,
  },
  word_type: {
    label: 'Word type',
    getValue: (e) => e.word_type || '',
    render: (v) => `<span class="pos">${v}</span>`,
  },
  example: {
    label: 'Example',
    getValue: (e) => e.example_sentence || '',
    render: (v) => `<div class="example">${v}</div>`,
  },
  example_blank: {
    label: 'Fill-in-blank',
    getValue: (e) => {
      const sentence = e.example_sentence || ''
      const target = e.word || e.term || e.title || ''
      if (!sentence) return ''
      if (!target) return sentence
      const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      return sentence.replace(new RegExp(escaped, 'gi'), '<b class="cloze">______</b>')
    },
    render: (v) => `<div class="example">${v}</div>`,
  },
  translation: {
    label: 'Translation',
    getValue: (e) => e.example_translation || '',
    render: (v) => `<div class="translation">${v}</div>`,
  },
  collocations: {
    label: 'Collocations',
    getValue: (e) => (e.collocations || []).filter(Boolean).join('\n'),
    render: (v) => {
      const items = v.split('\n').filter(Boolean)
      if (!items.length) return ''
      return `<ul class="collocations">${items.map(i => `<li>${i}</li>`).join('')}</ul>`
    },
  },
  image: {
    label: 'Image',
    getValue: (e, opts) => {
      if (opts.imageFilename) return opts.imageFilename
      const url = e.image_url || ''
      return url.startsWith('data:') ? '' : url
    },
    render: (v) => `<div class="media"><img src="${v}" alt=""></div>`,
  },
  audio: {
    label: 'Audio',
    getValue: (_, opts) => opts.audioFilename || '',
    render: (v) => `[sound:${v}]`,
  },
}

function prettifyFieldKey(key: string): string {
  const words = key.replace(/_/g, ' ').trim()
  return words ? `${words.charAt(0).toUpperCase()}${words.slice(1)}` : key
}

export function getFieldLabel(
  source: CardFieldSource,
  customLabels: Readonly<Record<string, string>> = {},
): string {
  const customKey = parseCustomFieldSource(source)
  if (customKey) return customLabels[customKey]?.trim() || prettifyFieldKey(customKey)
  return FIELD_LABELS[source as BuiltinCardFieldSource] ?? source
}

export function renderSide(
  blocks: CardFieldSource[],
  entry: Partial<Entry>,
  opts: RenderOpts = {},
): string {
  const side = opts.side || 'front'
  const parts = blocks
    .map(block => {
      const customKey = parseCustomFieldSource(block)
      if (customKey) {
        const rawValue = (entry as unknown as Record<string, unknown>)[customKey]
        const value = typeof rawValue === 'string'
          ? rawValue
          : Array.isArray(rawValue) && rawValue.every(item => typeof item === 'string')
            ? rawValue.join('\n')
            : ''
        return value ? `<div class="custom-field custom-${customKey}">${value}</div>` : ''
      }

      const renderer = FIELD_RENDERERS[block as BuiltinCardFieldSource]
      if (!renderer) return ''
      const value = renderer.getValue(entry, opts)
      if (!value) return ''
      // Preview: audio は [sound:] ではなく chip icon になる (Anki への export は [sound:] のまま)。
      if (block === 'audio' && opts.audioIcon) {
        return '<span class="audio-chip">🔊 Audio</span>'
      }
      return renderer.render(value)
    })
    .filter(Boolean)

  if (!parts.length) return ''
  return `<div class="${side}">${parts.join('\n')}</div>`
}

export const DEFAULT_TEMPLATES: Record<string, CardTemplate> = {
  word_to_meaning: {
    front: ['word', 'reading', 'han_viet'],
    back: ['meaning', 'word_type', 'image', 'audio'],
  },
  meaning_to_word: {
    front: ['meaning'],
    back: ['word', 'reading', 'han_viet', 'audio'],
  },
  audio_to_word: {
    front: ['audio'],
    back: ['word', 'reading', 'han_viet', 'meaning'],
  },
  image_to_word: {
    front: ['image'],
    back: ['word', 'reading', 'han_viet', 'meaning', 'audio'],
  },
  fill_in_blank: {
    front: ['example_blank'],
    back: ['example', 'translation', 'word', 'audio'],
  },
  reading_to_word: {
    front: ['reading'],
    back: ['word', 'han_viet', 'meaning', 'audio'],
  },
  word_to_reading: {
    front: ['word', 'han_viet'],
    back: ['reading', 'meaning', 'audio'],
  },
  concept_to_def: {
    front: ['word'],
    back: ['meaning', 'example', 'translation', 'audio'],
  },
  def_to_concept: {
    front: ['meaning'],
    back: ['word', 'example', 'audio'],
  },
  front_to_back: {
    front: ['word'],
    back: ['meaning', 'example', 'translation', 'audio'],
  },
}
