import { describe, expect, it } from 'vitest'
import { materializeContentTypeAiProfiles } from '@/lib/ai-agent/contentTypeProfiles'
import { createGenericAiOutputProfiles } from '@/lib/ai-agent/outputProfiles'
import { FormType } from '@/types'
import type { FormFieldConfig } from '@/types'

function field(
  fieldKey: string,
  sortOrder: number,
  overrides: Partial<FormFieldConfig> = {},
): FormFieldConfig {
  return {
    field_key: fieldKey,
    label: fieldKey,
    type: 'text',
    is_required: true,
    is_session_persistent: false,
    sort_order: sortOrder,
    ...overrides,
  }
}

describe('materializeContentTypeAiProfiles', () => {
  it('legacy Language document は default/en/zh/ja fallback を editor state にする', () => {
    const result = materializeContentTypeAiProfiles({
      code: 'language',
      name: 'Language',
      fields: [
        field('language', 0, { type: 'dropdown' }),
        field('word', 1),
      ],
    })

    expect(result.primaryFieldKey).toBe('word')
    expect(result.usesAiGeneration).toBe(true)
    expect(result.profiles.map(profile => profile.profile)).toEqual(['default', 'en', 'zh', 'ja'])
    expect(result.profiles.every(profile => profile.fields.some(output => output.key === 'word'))).toBe(true)
  })

  it('stored profile を primary invariant 付きで parse + clone する', () => {
    const stored = createGenericAiOutputProfiles('prompt', 'Prompt')
    const result = materializeContentTypeAiProfiles({
      code: 'quiz',
      name: 'Quiz',
      fields: [field('prompt', 0, { label: 'Prompt' })],
      ai_output_profiles: stored,
    })

    result.profiles[0].fields[0].instruction = 'Changed editor state'
    expect(stored[0].fields[0].instruction).toBe('Primary value for Prompt')
  })

  it('legacy custom document は primary field を含む generic default を materialize する', () => {
    const result = materializeContentTypeAiProfiles({
      code: 'medical_terms',
      name: 'Medical Terms',
      fields: [field('clinical_term', 0, { label: 'Clinical term' })],
    })

    expect(result.profiles).toHaveLength(1)
    expect(result.profiles[0].profile).toBe('default')
    expect(result.profiles[0].fields.map(output => output.key)).toEqual([
      'clinical_term',
      'meaning_vi',
      'example_sentence',
      'example_translation',
      'unsplash_search_keyword',
    ])
  })

  it('General form は local strategy のため profile fallback を作らない', () => {
    const result = materializeContentTypeAiProfiles({
      code: FormType.GENERAL,
      name: 'General',
      fields: [field('title', 0)],
    })

    expect(result.usesAiGeneration).toBe(false)
    expect(result.profiles).toEqual([])
  })

  it('stored profile から primary field が欠ける場合は拒否する', () => {
    expect(() => materializeContentTypeAiProfiles({
      code: 'quiz',
      name: 'Quiz',
      fields: [field('prompt', 0)],
      ai_output_profiles: [{
        profile: 'default',
        fields: [{ key: 'meaning_vi', type: 'string', instruction: 'Meaning' }],
      }],
    })).toThrow('must include primary field "prompt"')
  })
})
