import type { Entry } from '@/types'

interface CardTypeItem {
  id: string
  name: string
  code?: string
}

interface AnkiNote {
  deckName: string
  modelName: string
  fields: Record<string, string>
  tags?: string[]
}

export type { CardTypeItem, AnkiNote }

export function buildNotes(entry: Partial<Entry>, cardTypes: CardTypeItem[], audioFilename?: string, imageFilename?: string): AnkiNote[] {
  const deckName = entry.anki_deck || 'Default'
  const word = entry.word || entry.term || entry.title || ''
  const reading = entry.hiragana || entry.pinyin || entry.ipa || ''
  const meaning = entry.meaning_vi || entry.definition || ''
  const wordType = entry.word_type || ''
  const example = entry.example_sentence || ''
  const translation = entry.example_translation || ''
  const tags = entry.tags || []
  const imageHtml = imageFilename
    ? `<img src="${imageFilename}" style="max-height:200px">`
    : entry.image_url && !entry.image_url.startsWith('data:')
    ? `<img src="${entry.image_url}" style="max-height:200px">`
    : ''

  const audioTag = audioFilename ? `[sound:${audioFilename}]` : ''

  return cardTypes.map(ct => {
    const code = ct.code || ct.id
    let front = ''
    let back = ''

    switch (code) {
      case 'word_to_meaning':
        front = reading ? `${word}<br><small>${reading}</small>` : word
        back = `${meaning}${wordType ? `<br><small>${wordType}</small>` : ''}${imageHtml ? `<br>${imageHtml}` : ''}`
        break
      case 'meaning_to_word':
        front = meaning
        back = reading ? `${word}<br><small>${reading}</small>` : word
        break
      case 'audio_to_word':
        front = audioTag || word
        back = `${word}<br>${meaning}`
        break
      case 'image_to_word':
        front = imageHtml || '[image]'
        back = `${word}<br>${meaning}`
        break
      case 'fill_in_blank':
        if (example) {
          front = example.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '______')
          back = `${example}<br><small>${translation}</small>`
        } else {
          front = `______ = ${meaning}`
          back = word
        }
        break
      case 'reading_to_word':
        front = reading
        back = word
        break
      case 'word_to_reading':
        front = word
        back = reading
        break
      case 'concept_to_def':
        front = word
        back = meaning
        break
      case 'def_to_concept':
        front = meaning
        back = word
        break
      case 'front_to_back':
        front = word
        back = meaning
        break
      default:
        front = word
        back = meaning
        break
    }

    if (code !== 'audio_to_word' && audioTag) {
      back = `${back}<br>${audioTag}`
    }

    return {
      deckName,
      modelName: 'AnkiFlow-Basic',
      fields: { Front: front, Back: back },
      tags: [...tags, ...(entry.language ? [entry.language] : [])],
    }
  })
}
