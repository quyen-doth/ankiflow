import { describe, expect, it } from 'vitest'
import { buildTestGenerationRequest } from '@/lib/ai-agent/testGeneration'
import { FormType } from '@/types'
import type { AiOutputProfile, FormFieldConfig } from '@/types'

const fields: FormFieldConfig[] = [
  {
    field_key: 'language',
    label: 'Study language',
    type: 'dropdown',
    is_required: true,
    is_session_persistent: true,
    sort_order: 0,
  },
  {
    field_key: 'word',
    label: 'Word',
    type: 'text',
    is_required: true,
    is_session_persistent: false,
    sort_order: 1,
  },
]

const profiles: AiOutputProfile[] = [{
  profile: 'default',
  fields: [
    { key: 'word', type: 'string', instruction: 'Unsaved primary instruction' },
    { key: 'memory_hook', type: 'string', instruction: 'Unsaved memory hook' },
  ],
}]

describe('buildTestGenerationRequest', () => {
  it('Language draft の未保存 fields/profiles と study language を inline body に含める', () => {
    const body = buildTestGenerationRequest({
      contentType: {
        code: 'language',
        name: 'Language draft',
        description: 'Unsaved description',
        fields,
      },
      profiles,
      sample: ' book ',
      studyLanguage: { code: 'en', display_name: 'English' },
      outputLanguage: 'vi',
    })

    expect(body).toMatchObject({
      form_type: FormType.LANGUAGE,
      word: 'book',
      language: 'en',
      language_name: 'English',
      output_language: 'vi',
      content_type_inline: {
        code: 'language',
        name: 'Language draft',
        description: 'Unsaved description',
        fields,
        ai_output_profiles: profiles,
      },
    })
  })

  it('IT draft は sample を term として送る', () => {
    expect(buildTestGenerationRequest({
      contentType: {
        code: 'it',
        name: 'IT draft',
        description: '',
        fields: [{ ...fields[1], field_key: 'term', label: 'Term' }],
      },
      profiles: [{
        profile: 'default',
        fields: [{ key: 'term', type: 'string', instruction: 'Term' }],
      }],
      sample: 'event loop',
      outputLanguage: 'en',
    })).toMatchObject({
      form_type: FormType.IT,
      term: 'event loop',
      output_language: 'en',
    })
  })

  it('inherit/exclude metadata を inline profile に保持し、参照を共有しない', () => {
    const inheritedProfiles: AiOutputProfile[] = [
      ...profiles,
      { profile: 'zh', inherit: true, exclude: ['memory_hook'], fields: [] },
    ]
    const body = buildTestGenerationRequest({
      contentType: {
        code: 'language',
        name: 'Language draft',
        description: '',
        fields,
      },
      profiles: inheritedProfiles,
      sample: 'book',
      studyLanguage: { code: 'zh', display_name: 'Chinese' },
      outputLanguage: 'vi',
    })
    const inlineProfiles = (body.content_type_inline as {
      ai_output_profiles: AiOutputProfile[]
    }).ai_output_profiles

    expect(inlineProfiles).toEqual(inheritedProfiles)
    expect(inlineProfiles).not.toBe(inheritedProfiles)
    expect(inlineProfiles[1].exclude).not.toBe(inheritedProfiles[1].exclude)
  })
})
