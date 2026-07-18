import { describe, expect, it } from 'vitest'
import type { CardSpec } from '@/lib/ai-agent/card-spec'
import { resolveBuiltinAiOutputProfiles } from '@/lib/ai-agent/builtinOutputProfiles'
import { buildEngineCardSpec } from '@/lib/ai-agent/promptEngine'
import { inferLanguageDisplayName } from '@/lib/studyLanguages'
import { FormType } from '@/types'

interface JsonProperty {
  description?: string
  maxItems?: number
}

function properties(spec: CardSpec): Record<string, JsonProperty> {
  return (spec.inputSchema as { properties?: Record<string, JsonProperty> }).properties ?? {}
}

function languageSpec(language: string, outputCode = 'vi', outputName = 'Vietnamese'): CardSpec {
  return buildEngineCardSpec({
    definition: {
      name: 'Language',
      description: 'Vocabulary learning',
      primary_field_key: 'word',
      ai_output_profiles: resolveBuiltinAiOutputProfiles(FormType.LANGUAGE)!,
      field_labels: { word: 'Vocabulary item', note: 'Context note' },
    },
    studyLanguage: { code: language, name: inferLanguageDisplayName(language) },
    outputLanguage: { code: outputCode, name: outputName },
    primaryValue: 'sample',
  })
}

function itSpec(): CardSpec {
  return buildEngineCardSpec({
    definition: {
      name: 'IT Vocabulary',
      description: 'Programming and technology terms',
      primary_field_key: 'term',
      ai_output_profiles: resolveBuiltinAiOutputProfiles(FormType.IT)!,
      field_labels: { term: 'Technical term', definition: 'Your definition' },
    },
    outputLanguage: { code: 'vi', name: 'Vietnamese' },
    primaryValue: 'event loop',
    formValues: { term: 'event loop', definition: 'Coordinates callbacks' },
    topics: ['JavaScript', 'Runtime'],
  })
}

describe('prompt engine — built-in output contract', () => {
  const cases = [
    {
      name: 'English',
      engine: () => languageSpec('en'),
      keys: ['word', 'ipa', 'meaning_vi', 'word_type_vi', 'example_sentence', 'example_translation', 'example_blank', 'collocations', 'unsplash_search_keyword'],
    },
    {
      name: 'Chinese vi',
      engine: () => languageSpec('zh'),
      keys: ['word', 'pinyin', 'han_viet', 'meaning_vi', 'word_type', 'word_type_vi', 'level', 'example_sentence', 'example_translation', 'example_blank', 'collocations', 'related_words', 'unsplash_search_keyword'],
    },
    {
      name: 'Chinese en',
      engine: () => languageSpec('zh', 'en', 'English'),
      keys: ['word', 'pinyin', 'meaning_vi', 'word_type', 'word_type_vi', 'level', 'example_sentence', 'example_translation', 'example_blank', 'collocations', 'related_words', 'unsplash_search_keyword'],
    },
    {
      name: 'Japanese vi',
      engine: () => languageSpec('ja'),
      keys: ['word', 'hiragana', 'katakana', 'romaji', 'han_viet', 'meaning_vi', 'word_type_vi', 'level', 'example_sentence', 'example_translation', 'example_blank', 'collocations', 'related_words', 'unsplash_search_keyword'],
    },
    {
      name: 'Japanese en',
      engine: () => languageSpec('ja', 'en', 'English'),
      keys: ['word', 'hiragana', 'katakana', 'romaji', 'meaning_vi', 'word_type_vi', 'level', 'example_sentence', 'example_translation', 'example_blank', 'collocations', 'related_words', 'unsplash_search_keyword'],
    },
    {
      name: 'generic French',
      engine: () => languageSpec('fr'),
      keys: ['word', 'ipa', 'meaning_vi', 'word_type_vi', 'level', 'example_sentence', 'example_translation', 'example_blank', 'collocations', 'related_words', 'unsplash_search_keyword'],
    },
  ]

  for (const testCase of cases) {
    it(`${testCase.name}: stable field keys を維持する`, () => {
      const engineProperties = properties(testCase.engine())
      expect(Object.keys(engineProperties)).toEqual(testCase.keys)
      expect(engineProperties.meaning_vi?.description).toContain(
        testCase.name.endsWith(' en') ? 'English' : 'Vietnamese',
      )
    })
  }

  it('IT: stable field keys と descriptions を維持する', () => {
    const engineProperties = properties(itSpec())
    expect(Object.keys(engineProperties)).toEqual([
      'term',
      'definition_vi',
      'definition_short',
      'example_usage',
      'keywords',
      'related_topics',
      'analogy_vi',
      'unsplash_search_keyword',
    ])
    expect(engineProperties.definition_vi?.description).toBe('Clear, complete definition in Vietnamese')
  })

  it('言語固有の重要要件を system prompt に保持する', () => {
    const english = languageSpec('en')
    const chinese = languageSpec('zh')
    const japanese = languageSpec('ja')

    expect(english.systemPrompt).toContain('expert in English language')
    expect(english.systemPrompt).toContain('12 words or fewer')
    expect(english.systemPrompt).toContain('3-5')
    expect(chinese.systemPrompt).toContain('measure-word')
    expect(chinese.systemPrompt).toContain('一本书')
    expect(chinese.systemPrompt).toContain('HSK')
    expect(japanese.systemPrompt).toContain('particle combinations')
    expect(japanese.systemPrompt).toContain('reading fields')
    expect(japanese.systemPrompt).toContain('JLPT')
    expect(japanese.systemPrompt).toContain('entirely in kana')
    expect(japanese.systemPrompt).toContain('submit_card')
    expect(japanese.systemPrompt).toContain('Vietnamese')
  })

  it('IT user message は topics と label-based context を保持する', () => {
    const spec = itSpec()
    expect(spec.userMessage).toContain('Technical term: "event loop"')
    expect(spec.userMessage).toContain('Topics: JavaScript, Runtime')
    expect(spec.userMessage).toContain('Your definition: Coordinates callbacks')
  })
})
