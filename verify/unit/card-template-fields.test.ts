import { describe, expect, it } from 'vitest'
import { resolveCardTemplateCustomFields } from '@/lib/anki/cardTemplateFields'
import { FormType } from '@/types'
import type { AiOutputProfile, ContentType, FormFieldConfig } from '@/types'

const inputField = (fieldKey: string, label: string): FormFieldConfig => ({
  field_key: fieldKey,
  label,
  type: 'text',
  is_required: false,
  is_session_persistent: false,
  sort_order: 0,
})

const profile = (key: string, fields: AiOutputProfile['fields']): AiOutputProfile => ({
  profile: key,
  fields,
})

const languageContentType = {
  id: 'language-user',
  code: 'language',
  name: 'Language',
  description: '',
  icon: 'Languages',
  fields: [
    {
      ...inputField('language', 'Language'),
      type: 'dropdown',
      data_source: null,
    },
    inputField('word', 'Word'),
  ],
  ai_output_profiles: [
    profile('default', [
      { key: 'word', type: 'string', instruction: 'Word' },
      { key: 'default_note', type: 'string', instruction: 'Default note' },
    ]),
    profile('zh', [
      { key: 'word', type: 'string', instruction: 'Word' },
      { key: 'pinyin', type: 'string', instruction: 'Pinyin' },
      { key: 'meaning_vi', type: 'string', instruction: 'Meaning' },
      { key: 'phon_the', type: 'string', instruction: 'Traditional form' },
      { key: 'related_words', type: 'string_array', instruction: 'Related words' },
    ]),
  ],
  is_active: true,
  sort_order: 1,
} as ContentType

describe('resolveCardTemplateCustomFields', () => {
  it('routing alias と primary language profile を解決し、builtin output を除外する', () => {
    const fields = resolveCardTemplateCustomFields(
      [languageContentType],
      FormType.LANGUAGE,
      'zh-Hant',
    )

    expect(fields).toEqual([
      {
        key: 'phon_the',
        source: 'custom:phon_the',
        label: 'Phon the',
        sampleValue: 'Sample Phon the',
      },
      {
        key: 'related_words',
        source: 'custom:related_words',
        label: 'Related words',
        sampleValue: ['Sample Related words 1', 'Sample Related words 2'],
      },
    ])
  })

  it('language がない場合は default profile を使う', () => {
    expect(resolveCardTemplateCustomFields(
      [languageContentType],
      FormType.LANGUAGE,
      null,
    ).map(field => field.key)).toEqual(['default_note'])
  })

  it('language 固有 field は選択した language だけに表示する', () => {
    const contentType = {
      ...languageContentType,
      ai_output_profiles: [
        profile('default', [
          { key: 'word', type: 'string', instruction: 'Word' },
        ]),
        {
          ...profile('zh', [
            { key: 'word', type: 'string', instruction: 'Word' },
            { key: 'phon_the', type: 'string', instruction: 'Traditional form' },
          ]),
          inherit: true as const,
          exclude: [],
        },
      ],
    }

    expect(resolveCardTemplateCustomFields(
      [contentType],
      FormType.LANGUAGE,
      'zh',
    ).map(field => field.key)).toEqual(['phon_the'])
    expect(resolveCardTemplateCustomFields(
      [contentType],
      FormType.LANGUAGE,
      null,
    )).toEqual([])
  })

  it('Default custom field は All と選択した language の両方に表示する', () => {
    const contentType = {
      ...languageContentType,
      ai_output_profiles: [
        profile('default', [
          { key: 'word', type: 'string', instruction: 'Word' },
          { key: 'phon_the', type: 'string', instruction: 'Traditional form' },
        ]),
        {
          ...profile('zh', [
            { key: 'word', type: 'string', instruction: 'Word' },
          ]),
          inherit: true as const,
          exclude: [],
        },
      ],
    }

    expect(resolveCardTemplateCustomFields(
      [contentType],
      FormType.LANGUAGE,
      'zh',
    ).map(field => field.key)).toEqual(['phon_the'])
    expect(resolveCardTemplateCustomFields(
      [contentType],
      FormType.LANGUAGE,
      null,
    ).map(field => field.key)).toEqual(['phon_the'])
  })

  it('明示的な language inheritance は Default custom field と own field を両方返す', () => {
    const inheritedContentType = {
      ...languageContentType,
      ai_output_profiles: languageContentType.ai_output_profiles?.map(candidate => (
        candidate.profile === 'zh'
          ? { ...candidate, inherit: true as const, exclude: [] }
          : candidate
      )),
    }

    expect(resolveCardTemplateCustomFields(
      [inheritedContentType],
      FormType.LANGUAGE,
      'zh',
    ).map(field => field.key)).toEqual(['phon_the', 'related_words', 'default_note'])
    expect(resolveCardTemplateCustomFields(
      [inheritedContentType],
      FormType.LANGUAGE,
      null,
    ).map(field => field.key)).toEqual(['default_note'])
  })

  it('route が不一致、inactive、または profile が不正なら候補を返さない', () => {
    expect(resolveCardTemplateCustomFields([languageContentType], FormType.IT, 'zh')).toEqual([])
    expect(resolveCardTemplateCustomFields([
      { ...languageContentType, is_active: false },
    ], FormType.LANGUAGE, 'zh')).toEqual([])
    expect(resolveCardTemplateCustomFields([
      { ...languageContentType, ai_output_profiles: [{ profile: 'zh', fields: [] }] },
    ] as ContentType[], FormType.LANGUAGE, 'zh')).toEqual([])
  })
})
