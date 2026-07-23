import type { AiOutputField } from '@/types'

export interface FieldPreset extends AiOutputField {
  profiles: readonly string[]
  label: string
  description: string
}

export const FIELD_PRESETS = [
  {
    key: 'phon_the',
    type: 'string',
    instruction: 'Return the Traditional Chinese form of the vocabulary word. Return an empty string if identical to the simplified form.',
    profiles: ['zh'],
    label: 'Traditional form',
    description: 'Traditional Chinese variant when it differs from the input.',
  },
  {
    key: 'mau_cau',
    type: 'string_array',
    instruction: 'Return up to {max_items} common sentence patterns or grammatical constructions using the word. Include a concise explanation in {output_language}.',
    max_items: 5,
    profiles: ['zh'],
    label: 'Common sentence patterns',
    description: 'Reusable Chinese patterns and constructions for this word.',
  },
  {
    key: 'kanji_breakdown',
    type: 'string_array',
    instruction: 'For each kanji in the word, return one item with its meaning in {output_language}, on-reading, and kun-reading. Exclude kana.',
    profiles: ['ja'],
    label: 'Kanji breakdown',
    description: 'Meanings and common readings for each kanji.',
  },
  {
    key: 'mnemonic',
    type: 'string',
    instruction: 'Return one concise mnemonic in {output_language} that helps the learner remember this item.',
    profiles: ['default'],
    label: 'Mnemonic',
    description: 'A short memory aid for the item.',
  },
  {
    key: 'synonyms',
    type: 'string_array',
    instruction: 'Return the most useful synonyms, each with a concise distinction in {output_language}.',
    profiles: ['default'],
    label: 'Synonyms',
    description: 'Similar words with short meaning distinctions.',
  },
  {
    key: 'antonyms',
    type: 'string_array',
    instruction: 'Return the most useful antonyms, each with a concise meaning in {output_language}.',
    profiles: ['default'],
    label: 'Antonyms',
    description: 'Opposite words with short meanings.',
  },
  {
    key: 'common_mistakes',
    type: 'string_array',
    instruction: 'Return common usage, spelling, or grammar mistakes learners make with this item, explained concisely in {output_language}.',
    profiles: ['default'],
    label: 'Common mistakes',
    description: 'Frequent mistakes learners should avoid.',
  },
] as const satisfies readonly FieldPreset[]

/** profile に合う未追加 preset だけを catalog 順で返す。 */
export function resolveFieldPresets(
  profileKey: string,
  existingKeys: Iterable<string>,
): readonly FieldPreset[] {
  const normalizedProfile = profileKey.trim().toLowerCase()
  const existing = new Set(
    Array.from(existingKeys, key => key.trim()).filter(Boolean),
  )

  return FIELD_PRESETS.filter(preset => (
    preset.profiles.some(profile => profile === normalizedProfile)
    && !existing.has(preset.key)
  ))
}
