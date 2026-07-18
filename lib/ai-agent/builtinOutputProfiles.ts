import { FormType } from '@/types'
import { cloneAiOutputProfiles } from '@/lib/ai-agent/outputProfiles'
import type { AiOutputField, AiOutputProfile } from '@/types'

const field = (
  key: string,
  instruction: string,
  options: Omit<AiOutputField, 'key' | 'instruction'> = { type: 'string' },
): AiOutputField => ({ key, instruction, ...options })

const mediaKeyword = (): AiOutputField => field(
  'unsplash_search_keyword',
  'Short English keyword for an illustration image search',
)

const LANGUAGE_PROFILES: AiOutputProfile[] = [
  {
    profile: 'default',
    fields: [
      field('word', 'Vocabulary word in the target study language'),
      field('ipa', 'IPA pronunciation; return an empty string when unknown'),
      field('meaning_vi', 'Meaning in {output_language}'),
      field('word_type_vi', 'Part of speech written in {output_language}'),
      field('level', 'Common proficiency level when known; otherwise an empty string'),
      field('example_sentence', 'Short example sentence in the target study language'),
      field('example_translation', '{output_language} translation of the example sentence'),
      field('example_blank', 'Example sentence with the vocabulary word replaced by "___"'),
      field(
        'collocations',
        '3-5 common phrases with {output_language} meanings in parentheses',
        { type: 'string_array', max_items: 5 },
      ),
      field(
        'related_words',
        'Related words with {output_language} meanings',
        { type: 'string_array', max_items: 10 },
      ),
      mediaKeyword(),
    ],
  },
  {
    profile: 'en',
    fields: [
      field('word', 'English vocabulary word'),
      field('ipa', 'IPA pronunciation, e.g. /rɪˈzɪl.jənt/'),
      field('meaning_vi', 'Meaning in {output_language}'),
      field('word_type_vi', 'Part of speech written in {output_language}, e.g. "adjective"'),
      field('example_sentence', 'Natural English example sentence under 12 words'),
      field('example_translation', '{output_language} translation of the example sentence'),
      field('example_blank', 'Example sentence with the vocabulary word replaced by "___"'),
      field(
        'collocations',
        '3-5 common collocations with {output_language} meanings in parentheses',
        { type: 'string_array', max_items: 5 },
      ),
      mediaKeyword(),
    ],
  },
  {
    profile: 'zh',
    fields: [
      field('word', 'Chinese vocabulary word in Han characters'),
      field('pinyin', 'Pinyin pronunciation'),
      field('han_viet', 'Sino-Vietnamese reading of the word', { type: 'string', include_when: 'output_vi' }),
      field('meaning_vi', 'Meaning in {output_language}'),
      field('word_type', 'Part of speech in Chinese, e.g. 名词'),
      field('word_type_vi', 'Part of speech written in {output_language}, e.g. "noun"'),
      field('level', 'HSK level when known, e.g. HSK1; otherwise an empty string'),
      field('example_sentence', 'Natural Chinese example sentence under 10 words'),
      field('example_translation', '{output_language} translation of the example sentence'),
      field('example_blank', 'Example sentence with the vocabulary word replaced by "___"'),
      field(
        'collocations',
        '3-5 common phrases or measure-word combinations with {output_language} meanings',
        { type: 'string_array', max_items: 5 },
      ),
      field(
        'related_words',
        'Related words with {output_language} meanings',
        { type: 'string_array', max_items: 10 },
      ),
      mediaKeyword(),
    ],
  },
  {
    profile: 'ja',
    fields: [
      field('word', 'Japanese vocabulary word'),
      field('hiragana', 'Hiragana reading'),
      field('katakana', 'Katakana for loanwords; otherwise an empty string'),
      field('romaji', 'Latin transliteration in romaji'),
      field(
        'han_viet',
        'Sino-Vietnamese reading of the Kanji in the word; return an empty string for words written entirely in kana',
        { type: 'string', include_when: 'output_vi' },
      ),
      field('meaning_vi', 'Meaning in {output_language}'),
      field('word_type_vi', 'Part of speech written in {output_language}'),
      field('level', 'JLPT level when known, e.g. N5; otherwise an empty string'),
      field('example_sentence', 'Natural Japanese example sentence under 10 words'),
      field('example_translation', '{output_language} translation of the example sentence'),
      field('example_blank', 'Example sentence with the vocabulary word replaced by "___"'),
      field(
        'collocations',
        '3-5 common phrases or particle combinations with {output_language} meanings',
        { type: 'string_array', max_items: 5 },
      ),
      field(
        'related_words',
        'Related words with {output_language} meanings',
        { type: 'string_array', max_items: 10 },
      ),
      mediaKeyword(),
    ],
  },
]

const IT_PROFILES: AiOutputProfile[] = [{
  profile: 'default',
  fields: [
    field('term', 'IT term'),
    field('definition_vi', 'Clear, complete definition in {output_language}'),
    field('definition_short', 'Very short one-sentence definition'),
    field('example_usage', 'Short, realistic usage example'),
    field('keywords', 'Related keywords', { type: 'string_array', max_items: 10 }),
    field('related_topics', 'Related topics', { type: 'string_array', max_items: 10 }),
    field('analogy_vi', 'Everyday analogy in {output_language} to aid memory'),
    mediaKeyword(),
  ],
}]

const BUILTIN_AI_OUTPUT_PROFILES: Readonly<Partial<Record<FormType, readonly AiOutputProfile[]>>> = {
  [FormType.LANGUAGE]: LANGUAGE_PROFILES,
  [FormType.IT]: IT_PROFILES,
}

/** Built-in data を consumer が変更できないよう deep clone して返す。 */
export function resolveBuiltinAiOutputProfiles(formType: FormType | string): AiOutputProfile[] | null {
  const profiles = BUILTIN_AI_OUTPUT_PROFILES[formType as FormType]
  if (!profiles) return null
  return cloneAiOutputProfiles(profiles)
}
