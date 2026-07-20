import { describe, expect, it } from 'vitest'
import { resolveBuiltinAiOutputProfiles } from '@/lib/ai-agent/builtinOutputProfiles'
import {
  cloneStoredContentTypeAiProfiles,
  materializeContentTypeAiProfiles,
} from '@/lib/ai-agent/contentTypeProfiles'
import {
  createGenericAiOutputProfiles,
  normalizeAiOutputProfiles,
  parseAiOutputProfiles,
  resolveEffectiveProfileFields,
} from '@/lib/ai-agent/outputProfiles'
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

  it('legacy built-in profile は normalize 後も field と順序を完全に維持する', () => {
    const legacy = resolveBuiltinAiOutputProfiles(FormType.LANGUAGE)!
    const normalized = normalizeAiOutputProfiles(legacy)

    for (const language of ['en', 'zh', 'ja']) {
      const previousFields = legacy.find(profile => profile.profile === language)!.fields
      expect(resolveEffectiveProfileFields(normalized, language)).toEqual(previousFields)
    }
    expect(legacy.every(profile => profile.inherit === undefined && profile.exclude === undefined)).toBe(true)
    expect(normalized.filter(profile => profile.profile !== 'default').every(profile => (
      profile.inherit === true && Array.isArray(profile.exclude)
    ))).toBe(true)
  })

  it('normalize 後に Default へ追加した field を末尾で継承する', () => {
    const normalized = normalizeAiOutputProfiles([
      {
        profile: 'default',
        fields: [
          { key: 'word', type: 'string', instruction: 'Default word' },
          { key: 'ipa', type: 'string', instruction: 'Default IPA' },
        ],
      },
      {
        profile: 'zh',
        fields: [
          { key: 'word', type: 'string', instruction: 'Chinese word' },
          { key: 'pinyin', type: 'string', instruction: 'Pinyin' },
        ],
      },
    ])
    normalized[0].fields.push({
      key: 'phon_the',
      type: 'string',
      instruction: 'Traditional Chinese form',
    })

    expect(resolveEffectiveProfileFields(normalized, 'zh').map(output => output.key)).toEqual([
      'word',
      'pinyin',
      'phon_the',
    ])
  })

  it('own field は Default を上書きし、exclude field は継承しない', () => {
    const profiles = [
      {
        profile: 'default',
        fields: [
          { key: 'word', type: 'string' as const, instruction: 'Default word' },
          { key: 'meaning_vi', type: 'string' as const, instruction: 'Default meaning' },
          { key: 'phon_the', type: 'string' as const, instruction: 'Default traditional form' },
        ],
      },
      {
        profile: 'zh',
        inherit: true as const,
        exclude: ['meaning_vi'],
        fields: [{ key: 'word', type: 'string' as const, instruction: 'Chinese word' }],
      },
    ]

    expect(resolveEffectiveProfileFields(profiles, 'zh')).toEqual([
      { key: 'word', type: 'string', instruction: 'Chinese word' },
      { key: 'phon_the', type: 'string', instruction: 'Default traditional form' },
    ])
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

  it('parse failure fallback は Default edit 前に normalize して新 field を継承する', () => {
    const source = {
      code: 'language',
      name: 'Language',
      fields: [field('language', 0, { type: 'dropdown' }), field('word', 1)],
      ai_output_profiles: [
        {
          profile: 'default',
          fields: [{ key: 'word', type: 'string' as const, instruction: 'Default word' }],
        },
        {
          profile: 'zh-CN',
          fields: [{ key: 'word', type: 'string' as const, instruction: 'Chinese word' }],
        },
      ],
    }
    expect(() => materializeContentTypeAiProfiles(source)).toThrow()

    const fallback = cloneStoredContentTypeAiProfiles(source)
    fallback[1].profile = 'zh'
    fallback[0].fields.push({
      key: 'phon_the',
      type: 'string',
      instruction: 'Traditional Chinese form',
    })
    const saved = parseAiOutputProfiles(fallback, 'word')

    expect(saved[1]).toMatchObject({ inherit: true, exclude: [] })
    expect(resolveEffectiveProfileFields(saved, 'zh').map(output => output.key)).toEqual([
      'word',
      'phon_the',
    ])
  })

  it('profile 未設定 custom document は safe core fields を含む generic default を materialize する', () => {
    const result = materializeContentTypeAiProfiles({
      code: 'medical_terms',
      name: 'Medical Terms',
      fields: [
        field('clinical_term', 0, { label: 'Clinical term' }),
        field('clinical_note', 1),
        field('status', 2),
      ],
    })

    expect(result.profiles).toHaveLength(1)
    expect(result.profiles[0].profile).toBe('default')
    expect(result.profiles[0].fields.map(output => output.key)).toEqual([
      'clinical_term',
      'meaning_vi',
      'example_sentence',
      'example_translation',
      'unsplash_search_keyword',
      'clinical_note',
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
