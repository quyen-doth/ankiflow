import type { EntryCustomField } from '@/lib/entryCustomFields'
import type { Entry } from '@/types'

export type HistoryEntryUpdates = Partial<Entry> & Record<string, unknown>

export interface HistoryEntryMedia {
  audioUrl?: string | null
  audioExampleUrl?: string | null
}

/** History editor から保存する built-in/custom field を同じ payload にまとめる。 */
export function buildHistoryEntryUpdates(
  entry: Partial<Entry>,
  customFields: readonly EntryCustomField[],
  selectedCardTypeIds: readonly string[],
  media: HistoryEntryMedia = {},
): HistoryEntryUpdates {
  const customValues = Object.fromEntries(
    customFields.map(field => [field.key, field.value]),
  )
  const raw: Record<string, unknown> = {
    word: entry.word,
    term: entry.term,
    title: entry.title,
    meaning_vi: entry.meaning_vi,
    definition: entry.definition,
    word_type: entry.word_type,
    hiragana: entry.hiragana,
    pinyin: entry.pinyin,
    han_viet: entry.han_viet,
    ipa: entry.ipa,
    example_sentence: entry.example_sentence,
    example_translation: entry.example_translation,
    collocations: entry.collocations,
    image_url: entry.image_url,
    image_credit: entry.image_credit,
    audio_url: media.audioUrl ?? entry.audio_url,
    audio_example_url: media.audioExampleUrl ?? entry.audio_example_url,
    anki_deck: entry.anki_deck,
    card_type_ids: [...selectedCardTypeIds],
    category_id: entry.category_id ?? null,
    ...customValues,
  }

  return Object.fromEntries(
    Object.entries(raw).filter(([, value]) => value !== undefined),
  ) as HistoryEntryUpdates
}
