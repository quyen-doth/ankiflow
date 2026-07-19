import { describe, expect, it } from 'vitest'
import { findEntryContentType, resolveCustomFields } from '@/lib/entryCustomFields'
import { FormType } from '@/types'
import type { ContentType, FormFieldConfig } from '@/types'

const field = (fieldKey: string, label: string): FormFieldConfig => ({
  field_key: fieldKey,
  label,
  type: 'text',
  is_required: false,
  is_session_persistent: false,
  sort_order: 0,
})

const contentType = {
  id: 'language-user',
  code: 'language',
  name: 'Language',
  description: '',
  icon: 'Languages',
  fields: [
    {
      ...field('language', 'Language'),
      type: 'dropdown',
    },
    field('word', 'Word'),
    field('phon_the', 'Traditional form'),
  ],
  ai_output_profiles: [
    {
      profile: 'default',
      fields: [
        { key: 'word', type: 'string', instruction: 'Word' },
        { key: 'default_note', type: 'string', instruction: 'Default note' },
      ],
    },
    {
      profile: 'zh',
      fields: [
        { key: 'word', type: 'string', instruction: 'Word' },
        { key: 'pinyin', type: 'string', instruction: 'Pinyin' },
        { key: 'phon_the', type: 'string', instruction: 'Traditional form' },
        { key: 'related_words', type: 'string_array', instruction: 'Related words' },
      ],
    },
  ],
  is_active: true,
  sort_order: 1,
} as ContentType

describe('resolveCustomFields', () => {
  it('active language profile から custom fields を型付きで解決し、Form label を使う', () => {
    const fields = resolveCustomFields({
      form_type: FormType.LANGUAGE,
      language: 'zh-Hant',
      word: '吃饭',
      pinyin: 'chī fàn',
      ...({ phon_the: '喫飯', related_words: ['用餐', '吃東西'] } as Record<string, unknown>),
    }, contentType)

    expect(fields).toEqual([
      { key: 'phon_the', label: 'Traditional form', value: '喫飯' },
      { key: 'related_words', label: 'Related words', value: ['用餐', '吃東西'] },
    ])
  })

  it('profile 未定義の Entry custom field を保持し、reserved/builtin/非文字列を除外する', () => {
    const fields = resolveCustomFields({
      word: 'legacy',
      user_id: 'uid-1',
      ...({
        legacy_note: 'Keep me',
        legacy_items: ['one', 'two'],
        invalid_value: 42,
        image_url: 'https://example.com/image.jpg',
      } as Record<string, unknown>),
    })

    expect(fields).toEqual([
      { key: 'legacy_note', label: 'Legacy note', value: 'Keep me' },
      { key: 'legacy_items', label: 'Legacy items', value: ['one', 'two'] },
    ])
  })

  it('profile にある未生成 field も編集用の空値として返す', () => {
    expect(resolveCustomFields({ language: 'zh' }, contentType)).toEqual([
      { key: 'phon_the', label: 'Traditional form', value: '' },
      { key: 'related_words', label: 'Related words', value: [] },
    ])
  })
})

describe('findEntryContentType', () => {
  it('built-in alias を runtime route に解決する', () => {
    expect(findEntryContentType([contentType], FormType.LANGUAGE)?.id).toBe('language-user')
  })

  it('inactive または routing conflict の Content Type は選ばない', () => {
    expect(findEntryContentType([{ ...contentType, is_active: false }], FormType.LANGUAGE)).toBeUndefined()
    expect(findEntryContentType([
      contentType,
      { ...contentType, id: 'duplicate', code: FormType.LANGUAGE },
    ], FormType.LANGUAGE)).toBeUndefined()
  })
})
