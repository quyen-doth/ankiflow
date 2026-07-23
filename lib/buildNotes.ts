import type { Entry, CardTemplate } from '@/types'
import { ANKI_MODEL_NAME } from '@/lib/anki/model'
import { renderSide, resolveCardTemplate } from '@/lib/anki/renderCard'

interface CardTypeItem {
  id: string
  name: string
  code?: string
  template?: CardTemplate
}

interface AnkiNote {
  deckName: string
  modelName: string
  fields: Record<string, string>
  tags?: string[]
}

export type { CardTypeItem, AnkiNote }

export function buildNotes(
  entry: Partial<Entry>,
  cardTypes: CardTypeItem[],
  audioFilename?: string,
  imageFilename?: string,
): AnkiNote[] {
  const deckName = entry.anki_deck || 'Default'
  const tags = [...(entry.tags || []), ...(entry.language ? [entry.language] : [])]

  return cardTypes.map(ct => {
    const template = resolveCardTemplate(ct)

    const front = renderSide(template.front, entry, { audioFilename, imageFilename, side: 'front' })
    const back = renderSide(template.back, entry, { audioFilename, imageFilename, side: 'back' })

    return {
      deckName,
      modelName: ANKI_MODEL_NAME,
      fields: { Front: front, Back: back },
      tags,
    }
  })
}
