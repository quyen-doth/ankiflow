import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONTENT_TYPES,
  isProtectedGlobalContentTypeId,
  materializeUserContentType,
  parseContentTypeConfig,
  prepareRuntimeContentTypes,
  resolveContentTypeFormType,
  resolveRuntimeContentTypeCode,
  userContentTypeId,
  validateContentTypeConfig,
} from '@/lib/contentTypes'
import {
  CONTENT_TYPE_CODE_PATTERN,
  GLOBAL_CONTENT_TYPES_COLLECTION,
  PROTECTED_GLOBAL_CONTENT_TYPE_IDS,
  USER_CONTENT_TYPES_COLLECTION,
} from '@/lib/constants'
import { FormType } from '@/types'
import { createGenericAiOutputProfiles } from '@/lib/ai-agent/outputProfiles'
import type {
  ContentTypeSourceDocument,
  EditableContentTypeData,
} from '@/lib/contentTypes'

function validConfig(overrides: Partial<EditableContentTypeData> = {}): EditableContentTypeData {
  return {
    code: 'medical_terms',
    name: 'Medical Terms',
    description: 'Medical vocabulary',
    icon: 'Stethoscope',
    fields: [
      {
        field_key: 'term',
        label: 'Term',
        type: 'text',
        is_required: true,
        is_session_persistent: false,
        sort_order: 0,
        placeholder: null,
        data_source: null,
      },
    ],
    is_active: true,
    sort_order: 1,
    default_create_mode: 'single',
    ...overrides,
  }
}

function sourceDocument(): ContentTypeSourceDocument {
  return {
    id: 'global-medical',
    ...validConfig(),
    user_id: 'source-owner-must-not-copy',
    source_content_type_id: 'old-source-must-not-copy',
    created_at: 'old-created-at',
    updated_at: 'old-updated-at',
  }
}

describe('Content Type constants', () => {
  it('global/user collection names を固定する', () => {
    expect(GLOBAL_CONTENT_TYPES_COLLECTION).toBe('content_types')
    expect(USER_CONTENT_TYPES_COLLECTION).toBe('user_content_types')
  })

  it('3 built-in global IDs だけを protected と判定する', () => {
    expect(PROTECTED_GLOBAL_CONTENT_TYPE_IDS).toEqual([
      FormType.LANGUAGE,
      FormType.IT,
      FormType.GENERAL,
    ])
    for (const id of PROTECTED_GLOBAL_CONTENT_TYPE_IDS) {
      expect(isProtectedGlobalContentTypeId(id)).toBe(true)
    }
    expect(isProtectedGlobalContentTypeId('custom_medical')).toBe(false)
  })

  it('Content Type code は lowercase snake_case のみ受け付ける', () => {
    expect(CONTENT_TYPE_CODE_PATTERN.test('medical_terms_2')).toBe(true)
    expect(CONTENT_TYPE_CODE_PATTERN.test('MedicalTerms')).toBe(false)
    expect(CONTENT_TYPE_CODE_PATTERN.test('medical-terms')).toBe(false)
    expect(CONTENT_TYPE_CODE_PATTERN.test('2medical')).toBe(false)
  })
})

describe('default global Content Types', () => {
  it('既存 seed と同じ built-in IDs、codes、mode、field keys を保持する', () => {
    expect(DEFAULT_CONTENT_TYPES.map(contentType => ({
      id: contentType.id,
      code: contentType.code,
      mode: contentType.default_create_mode,
      fields: contentType.fields.map(field => field.field_key),
    }))).toEqual([
      {
        id: FormType.LANGUAGE,
        code: 'language',
        mode: 'batch',
        fields: ['language', 'anki_deck', 'category_id', 'tags', 'word', 'note', 'card_type_ids'],
      },
      {
        id: FormType.IT,
        code: 'it',
        mode: 'single',
        fields: ['anki_deck', 'topic_ids', 'difficulty', 'term', 'definition', 'keywords', 'card_type_ids'],
      },
      {
        id: FormType.GENERAL,
        code: 'general',
        mode: 'single',
        fields: ['anki_deck', 'title', 'content', 'tags'],
      },
    ])
    expect(DEFAULT_CONTENT_TYPES.every(contentType => contentType.is_active)).toBe(true)
    expect(DEFAULT_CONTENT_TYPES[0].ai_output_profiles?.map(profile => profile.profile))
      .toEqual(['default', 'en', 'zh', 'ja'])
    expect(DEFAULT_CONTENT_TYPES[1].ai_output_profiles?.map(profile => profile.profile))
      .toEqual(['default'])
    expect(DEFAULT_CONTENT_TYPES[2].ai_output_profiles).toBeUndefined()
  })
})

describe('Content Type materialization', () => {
  it('同じ source ID + UID から安定した deterministic ID を作る', () => {
    expect(userContentTypeId('form_language', 'user-1')).toBe('form_language__user-1')
    expect(userContentTypeId('form_language', 'user-1')).toBe(
      userContentTypeId('form_language', 'user-1'),
    )
  })

  it('ownership metadata/timestamps をコピーせず、新しい owner/source を設定する', () => {
    const materialized = materializeUserContentType(sourceDocument(), 'user-1')

    expect(materialized.id).toBe('global-medical__user-1')
    expect(materialized.data).toMatchObject({
      user_id: 'user-1',
      source_content_type_id: 'global-medical',
      code: 'medical_terms',
      name: 'Medical Terms',
    })
    expect(materialized.data).not.toHaveProperty('created_at')
    expect(materialized.data).not.toHaveProperty('updated_at')
  })

  it('AI output profiles を user snapshot へ deep clone する', () => {
    const source = sourceDocument()
    source.ai_output_profiles = createGenericAiOutputProfiles('term', 'Term')

    const materialized = materializeUserContentType(source, 'user-1')
    materialized.data.ai_output_profiles![0].fields[0].instruction = 'Changed snapshot'

    expect(source.ai_output_profiles[0].fields[0].instruction).toBe('Primary value for Term')
  })

  it('fields[] を deep clone し、source と参照を共有しない', () => {
    const source = sourceDocument()
    source.fields[0].options = ['First', 'Second']
    const materialized = materializeUserContentType(source, 'user-1')

    expect(materialized.data.fields).not.toBe(source.fields)
    expect(materialized.data.fields[0]).not.toBe(source.fields[0])
    expect(materialized.data.fields[0].options).not.toBe(source.fields[0].options)
    source.fields[0].label = 'Changed after materialization'
    source.fields[0].options![0] = 'Changed option'
    expect(materialized.data.fields[0].label).toBe('Term')
    expect(materialized.data.fields[0].options).toEqual(['First', 'Second'])
  })
})

describe('Content Type routing resolver', () => {
  it.each([
    ['language', FormType.LANGUAGE],
    [FormType.LANGUAGE, FormType.LANGUAGE],
    ['it', FormType.IT],
    [FormType.IT, FormType.IT],
    ['general', FormType.GENERAL],
    [FormType.GENERAL, FormType.GENERAL],
  ])('%s → %s', (code, expected) => {
    expect(resolveContentTypeFormType(code)).toBe(expected)
  })

  it('custom code は built-in FormType に解決しない', () => {
    expect(resolveContentTypeFormType('medical_terms')).toBeNull()
  })

  it('runtime routing は document ID ではなく code のみを正規化する', () => {
    expect(resolveRuntimeContentTypeCode(' language ')).toBe(FormType.LANGUAGE)
    expect(resolveRuntimeContentTypeCode('medical_terms')).toBe('medical_terms')
  })
})

describe('runtime Content Type preparation', () => {
  function runtimeContentType(overrides: Partial<ContentTypeSourceDocument> = {}): ContentTypeSourceDocument {
    return {
      ...sourceDocument(),
      id: overrides.id ?? 'runtime-medical',
      code: overrides.code ?? 'medical_terms',
      name: overrides.name ?? 'Medical Terms',
      is_active: overrides.is_active ?? true,
      sort_order: overrides.sort_order ?? 1,
      ...overrides,
    }
  }

  it('active document だけを sort_order 順に並べ、入力配列を変更しない', () => {
    const input = [
      runtimeContentType({ id: 'later', code: 'later', sort_order: 20 }),
      runtimeContentType({ id: 'inactive', code: 'inactive', is_active: false, sort_order: 0 }),
      runtimeContentType({ id: 'first', code: 'first', sort_order: 10 }),
    ]

    const result = prepareRuntimeContentTypes(input)

    expect(result.contentTypes.map(contentType => contentType.id)).toEqual(['first', 'later'])
    expect(result.conflictingCodes).toEqual([])
    expect(input.map(contentType => contentType.id)).toEqual(['later', 'inactive', 'first'])
  })

  it('同じ code の duplicate を inactive document も含めて検出し、競合分を一覧から除外する', () => {
    const result = prepareRuntimeContentTypes([
      runtimeContentType({ id: 'active', code: 'medical_terms' }),
      runtimeContentType({ id: 'inactive', code: 'medical_terms', is_active: false }),
    ])

    expect(result.conflictingCodes).toEqual(['medical_terms'])
    expect(result.contentTypes).toEqual([])
  })

  it('同じ built-in route に解決される alias も競合として検出する', () => {
    const result = prepareRuntimeContentTypes([
      runtimeContentType({ id: 'short-code', code: 'language' }),
      runtimeContentType({ id: 'enum-code', code: FormType.LANGUAGE }),
    ])

    expect(result.conflictingCodes).toEqual([FormType.LANGUAGE, 'language'])
    expect(result.contentTypes).toEqual([])
  })

  it('競合していない Content Type は競合と共存しても利用可能なまま残す', () => {
    const result = prepareRuntimeContentTypes([
      runtimeContentType({ id: 'dup-a', code: 'language', sort_order: 1 }),
      runtimeContentType({ id: 'dup-b', code: FormType.LANGUAGE, sort_order: 2 }),
      runtimeContentType({ id: 'ok', code: 'quiz', sort_order: 3 }),
    ])

    expect(result.conflictingCodes).toEqual([FormType.LANGUAGE, 'language'])
    expect(result.contentTypes.map(contentType => contentType.id)).toEqual(['ok'])
  })
})

describe('Content Type validation', () => {
  it('valid AI output profiles を parse し、不正 profile を拒否する', () => {
    const valid = validateContentTypeConfig(validConfig({
      ai_output_profiles: createGenericAiOutputProfiles('term', 'Term'),
    }))
    expect(valid.success).toBe(true)

    const invalid = validateContentTypeConfig({
      ...validConfig(),
      ai_output_profiles: [{
        profile: 'default',
        fields: [{ key: 'status', type: 'string', instruction: 'Reserved metadata' }],
      }],
    })
    expect(invalid.success).toBe(false)
  })

  it.each(['', 'MedicalTerms', 'medical-terms', '_medical', '2medical'])(
    'invalid code %j を拒否する',
    code => {
      expect(validateContentTypeConfig(validConfig({ code })).success).toBe(false)
    },
  )

  it('name が空の場合は拒否する', () => {
    expect(validateContentTypeConfig(validConfig({ name: '   ' })).success).toBe(false)
  })

  it('field_key の重複を大文字小文字に関係なく拒否する', () => {
    const result = validateContentTypeConfig(validConfig({
      fields: [
        ...validConfig().fields,
        { ...validConfig().fields[0], field_key: 'TERM', sort_order: 1 },
      ],
    }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues).toContainEqual(expect.objectContaining({ path: 'fields.1.field_key' }))
    }
  })

  it('field configuration が不正な場合は拒否する', () => {
    const input = {
      ...validConfig(),
      fields: [{
        field_key: 'term',
        label: '',
        type: 'unsupported',
        is_required: true,
        is_session_persistent: false,
        sort_order: -1,
      }],
    }
    expect(validateContentTypeConfig(input).success).toBe(false)
  })

  it('update で code を変更する場合は拒否する', () => {
    const result = validateContentTypeConfig(validConfig({ code: 'changed_code' }), 'medical_terms')
    expect(result).toEqual({
      success: false,
      issues: [{ path: 'code', message: 'Content type code cannot be changed after creation' }],
    })
  })

  it('有効な config を trim して返す', () => {
    const parsed = parseContentTypeConfig(validConfig({ code: ' medical_terms ', name: ' Medical Terms ' }))
    expect(parsed.code).toBe('medical_terms')
    expect(parsed.name).toBe('Medical Terms')
  })
})
