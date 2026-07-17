import { describe, expect, it } from 'vitest'
import {
  BUILTIN_BLUEPRINTS,
  getBlueprintForContentType,
  resolveBuiltinFormType,
  validateContentTypeBlueprint,
} from '@/lib/create/formBlueprint'
import { DEFAULT_CONTENT_TYPES } from '@/lib/contentTypes'
import { FormType } from '@/types'
import type { ContentType, FirestoreTimestamp, FormFieldConfig } from '@/types'

const ts: FirestoreTimestamp = {
  seconds: 0,
  nanoseconds: 0,
  toDate: () => new Date(0),
}

function makeCt(overrides: Partial<ContentType> & { id: string; code: string }): ContentType {
  return {
    name: overrides.code,
    description: '',
    icon: 'BookOpen',
    fields: [],
    is_active: true,
    sort_order: 0,
    created_at: ts,
    updated_at: ts,
    ...overrides,
  }
}

function defaultFields(formType: FormType): FormFieldConfig[] {
  return DEFAULT_CONTENT_TYPES.find(contentType => contentType.id === formType)!.fields
    .map(field => ({ ...field }))
}

function field(overrides: Partial<FormFieldConfig> & { field_key: string }): FormFieldConfig {
  return {
    label: overrides.field_key,
    type: 'text',
    is_required: false,
    is_session_persistent: false,
    sort_order: 0,
    placeholder: null,
    data_source: null,
    ...overrides,
  }
}

describe('resolveBuiltinFormType', () => {
  it('map alias code (seed) sang FormType built-in', () => {
    expect(resolveBuiltinFormType('language')).toBe(FormType.LANGUAGE)
    expect(resolveBuiltinFormType('it')).toBe(FormType.IT)
    expect(resolveBuiltinFormType('general')).toBe(FormType.GENERAL)
  })

  it('完全な enum 値との後方互換性を維持', () => {
    expect(resolveBuiltinFormType('form_language')).toBe(FormType.LANGUAGE)
    expect(resolveBuiltinFormType('form_it')).toBe(FormType.IT)
    expect(resolveBuiltinFormType('form_general')).toBe(FormType.GENERAL)
  })

  it('built-in でない code に対して null を返す', () => {
    expect(resolveBuiltinFormType('test_1')).toBeNull()
    expect(resolveBuiltinFormType('anything_else')).toBeNull()
  })
})

describe('getBlueprintForContentType', () => {
  it('content type seed "言語" (id form_language / code language) → built-in の Language blueprint', () => {
    const bp = getBlueprintForContentType(makeCt({
      id: 'form_language',
      code: 'language',
      name: '言語',
      fields: defaultFields(FormType.LANGUAGE),
    }))
    expect(bp.formType).toBe(FormType.LANGUAGE)
    expect(bp.uiFormType).toBe('Language')
    expect(bp.coreFields[0].key).toBe('word')
  })

  it('content type seed "IT Vocabulary" (code it) → built-in の IT blueprint', () => {
    const bp = getBlueprintForContentType(makeCt({
      id: 'form_it',
      code: 'it',
      name: 'IT Vocabulary',
      fields: defaultFields(FormType.IT),
    }))
    expect(bp.formType).toBe(FormType.IT)
    expect(bp.coreFields[0].key).toBe('term')
  })

  it('content type seed "一般知識" (code general) → built-in の General blueprint', () => {
    const bp = getBlueprintForContentType(makeCt({
      id: 'form_general',
      code: 'general',
      name: '一般知識',
      fields: defaultFields(FormType.GENERAL),
    }))
    expect(bp.formType).toBe(FormType.GENERAL)
    expect(bp.coreFields[0].key).toBe('title')
  })

  it('content type custom (code test_1) → fields[] から構築された blueprint、built-in ではない', () => {
    const fields: FormFieldConfig[] = [
      { field_key: 'prompt', label: 'Prompt', type: 'text', is_required: true, is_session_persistent: false, sort_order: 1, placeholder: null, data_source: null },
      { field_key: 'answer', label: 'Answer', type: 'textarea', is_required: false, is_session_persistent: false, sort_order: 2, placeholder: null, data_source: null },
    ]
    const bp = getBlueprintForContentType(makeCt({ id: 'auto123', code: 'test_1', name: 'test 1', fields }))
    expect(bp.formType).toBe('test_1')
    expect(bp.uiFormType).toBeUndefined()
    expect(bp.coreFields.map(f => f.key)).toEqual(['prompt', 'answer'])
  })

  it('copied document ID が built-in に似ていても code だけで routing する', () => {
    const fields: FormFieldConfig[] = [
      { field_key: 'prompt', label: 'Prompt', type: 'text', is_required: true, is_session_persistent: false, sort_order: 1, placeholder: null, data_source: null },
    ]
    const bp = getBlueprintForContentType(makeCt({
      id: 'form_language__user-1',
      code: 'custom_prompt',
      name: 'Custom Prompt',
      fields,
    }))

    expect(bp.formType).toBe('custom_prompt')
    expect(bp).not.toBe(BUILTIN_BLUEPRINTS[FormType.LANGUAGE])
  })

  it('built-in fields[] が order/label/placeholder/required/hidden controls を決定する', () => {
    const bp = getBlueprintForContentType(makeCt({
      id: 'form_language__user-1',
      code: 'language',
      fields: [
        field({ field_key: 'language', label: 'Study language', type: 'dropdown', is_required: true, is_session_persistent: true, sort_order: 0 }),
        field({ field_key: 'note', label: 'Usage context', type: 'textarea', is_required: true, is_session_persistent: true, sort_order: 1, placeholder: 'Context for AI' }),
        field({ field_key: 'word', label: 'Term to learn', is_required: true, sort_order: 2, placeholder: 'Enter a word' }),
      ],
    }))

    expect(bp.primaryFieldKey).toBe('word')
    expect(bp.coreFields.map(core => core.key)).toEqual(['note', 'word'])
    expect(bp.coreFields[0]).toMatchObject({
      label: 'Usage context',
      placeholder: 'Context for AI',
      required: true,
      persistent: true,
    })
    expect(bp.configBlocks.map(block => block.kind)).toEqual(['language'])
  })

  it('標準 control alias を fields[] の順序で mapping する', () => {
    const bp = getBlueprintForContentType(makeCt({
      id: 'custom',
      code: 'custom_type',
      fields: [
        field({ field_key: 'decks', label: 'Deck', type: 'dropdown', data_source: 'decks', sort_order: 0 }),
        field({ field_key: 'categories', label: 'Category', type: 'dropdown', data_source: 'categories', sort_order: 1 }),
        field({ field_key: 'card_types', label: 'Card Types', type: 'checkbox_group', data_source: 'card_types', sort_order: 2 }),
        field({ field_key: 'topics', label: 'Topics', type: 'checkbox_group', data_source: 'topics', sort_order: 3 }),
        field({ field_key: 'prompt', label: 'Prompt', is_required: true, sort_order: 4 }),
      ],
    }))

    expect(bp.configBlocks.map(block => block.kind)).toEqual(['deck', 'category', 'cardTypes', 'topic'])
    expect(bp.coreFields.map(core => core.key)).toEqual(['prompt'])
  })

  it('custom dropdown の static options を blueprint に渡す', () => {
    const bp = getBlueprintForContentType(makeCt({
      id: 'custom',
      code: 'custom_type',
      fields: [
        field({
          field_key: 'level',
          label: 'Level',
          type: 'dropdown',
          is_required: true,
          options: ['Beginner', 'Advanced'],
        }),
      ],
    }))

    expect(bp.coreFields[0]).toMatchObject({
      key: 'level',
      type: 'dropdown',
      options: ['Beginner', 'Advanced'],
    })
  })
})

describe('Content Type blueprint invariants', () => {
  it.each([
    ['language', [field({ field_key: 'word', is_required: true })], 'language'],
    ['it', [field({ field_key: 'definition' })], 'term'],
    ['general', [field({ field_key: 'content' })], 'title'],
  ])('built-in %s の必須 field 不足を拒否する', (code, fields, expected) => {
    const result = validateContentTypeBlueprint({ code, name: code, fields })
    expect(result).toEqual(expect.objectContaining({ success: false }))
    if (!result.success) expect(result.error).toContain(expected)
  })

  it('custom Content Type に core input が無い場合は拒否する', () => {
    const result = validateContentTypeBlueprint({
      code: 'custom_type',
      name: 'Custom',
      fields: [field({ field_key: 'tags', type: 'tags' })],
    })
    expect(result).toEqual({
      success: false,
      error: 'Custom Content Type must define at least one supported core input field.',
    })
  })

  it('unsupported type/control と custom data source を明示的に拒否する', () => {
    const unsupportedType = validateContentTypeBlueprint({
      code: 'custom_type',
      name: 'Custom',
      fields: [field({ field_key: 'choices', type: 'checkbox_group' })],
    })
    const unsupportedSource = validateContentTypeBlueprint({
      code: 'custom_type',
      name: 'Custom',
      fields: [field({ field_key: 'prompt', type: 'dropdown', data_source: 'unknown_collection' })],
    })

    expect(!unsupportedType.success && unsupportedType.error).toContain('not supported as a core input')
    expect(!unsupportedSource.success && unsupportedSource.error).toContain('data source "unknown_collection"')
  })
})

describe('IT blueprint payload', () => {
  it('AI に Topic ID ではなく Topic 名を渡す', () => {
    const blueprint = BUILTIN_BLUEPRINTS[FormType.IT]!
    if (blueprint.generate.mode !== 'api') throw new Error('IT blueprint must use API generation')

    expect(blueprint.generate.payload(
      { term: 'Event Loop' },
      { topicIds: ['topic-1'], topicNames: ['JavaScript Runtime'] },
    )).toMatchObject({
      topics: ['JavaScript Runtime'],
    })
  })
})
