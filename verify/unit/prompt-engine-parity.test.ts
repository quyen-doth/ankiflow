import { describe, expect, it } from 'vitest'
import {
  buildChineseCardSchema,
  buildEnglishCardSchema,
  buildGenericLanguageCardSchema,
  buildItVocabCardSchema,
  buildJapaneseCardSchema,
  toToolInputSchema,
  type CardSpec,
} from '@/lib/ai-agent/card-schemas'
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

describe('prompt engine — legacy schema parity', () => {
  const cases = [
    { name: 'English', engine: () => languageSpec('en'), legacy: () => buildEnglishCardSchema('Vietnamese') },
    { name: 'Chinese vi', engine: () => languageSpec('zh'), legacy: () => buildChineseCardSchema('Vietnamese', true) },
    { name: 'Chinese en', engine: () => languageSpec('zh', 'en', 'English'), legacy: () => buildChineseCardSchema('English', false) },
    { name: 'Japanese vi', engine: () => languageSpec('ja'), legacy: () => buildJapaneseCardSchema('Vietnamese', true) },
    { name: 'Japanese en', engine: () => languageSpec('ja', 'en', 'English'), legacy: () => buildJapaneseCardSchema('English', false) },
    { name: 'generic French', engine: () => languageSpec('fr'), legacy: () => buildGenericLanguageCardSchema('Vietnamese') },
  ]

  for (const testCase of cases) {
    it(`${testCase.name}: field keys と descriptions を維持する`, () => {
      const engineProperties = properties(testCase.engine())
      const legacyProperties = (
        toToolInputSchema(testCase.legacy()) as { properties: Record<string, JsonProperty> }
      ).properties

      expect(Object.keys(engineProperties)).toEqual(Object.keys(legacyProperties))
      for (const key of Object.keys(legacyProperties)) {
        if (key === 'han_viet') {
          expect(engineProperties[key]?.description).toContain('Sino-Vietnamese')
          continue
        }
        expect(engineProperties[key]?.description, key).toBe(legacyProperties[key]?.description)
      }
    })
  }

  it('IT: field keys と descriptions を維持する', () => {
    const engineProperties = properties(itSpec())
    const legacyProperties = (
      toToolInputSchema(buildItVocabCardSchema('Vietnamese')) as {
        properties: Record<string, JsonProperty>
      }
    ).properties

    expect(Object.keys(engineProperties)).toEqual(Object.keys(legacyProperties))
    for (const key of Object.keys(legacyProperties)) {
      expect(engineProperties[key]?.description, key).toBe(legacyProperties[key]?.description)
    }
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
