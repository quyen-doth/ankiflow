import { describe, expect, it } from 'vitest'
import {
  BUILTIN_BLUEPRINTS,
  getBlueprintForContentType,
  resolveBuiltinFormType,
} from '@/lib/create/formBlueprint'
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

describe('resolveBuiltinFormType', () => {
  it('map alias code (seed) sang FormType built-in', () => {
    expect(resolveBuiltinFormType('language')).toBe(FormType.LANGUAGE)
    expect(resolveBuiltinFormType('it')).toBe(FormType.IT)
    expect(resolveBuiltinFormType('general')).toBe(FormType.GENERAL)
  })

  it('giữ tương thích ngược với giá trị enum đầy đủ', () => {
    expect(resolveBuiltinFormType('form_language')).toBe(FormType.LANGUAGE)
    expect(resolveBuiltinFormType('form_it')).toBe(FormType.IT)
    expect(resolveBuiltinFormType('form_general')).toBe(FormType.GENERAL)
  })

  it('trả null cho code không phải built-in', () => {
    expect(resolveBuiltinFormType('test_1')).toBeNull()
    expect(resolveBuiltinFormType('anything_else')).toBeNull()
  })
})

describe('getBlueprintForContentType', () => {
  it('content type seed "Ngôn ngữ" (id form_language / code language) → blueprint Language built-in', () => {
    const bp = getBlueprintForContentType(makeCt({ id: 'form_language', code: 'language', name: 'Ngôn ngữ' }))
    expect(bp).toBe(BUILTIN_BLUEPRINTS[FormType.LANGUAGE])
    expect(bp.formType).toBe(FormType.LANGUAGE)
    expect(bp.uiFormType).toBe('Language')
    expect(bp.coreFields[0].key).toBe('word')
  })

  it('content type seed "IT Vocabulary" (code it) → blueprint IT built-in', () => {
    const bp = getBlueprintForContentType(makeCt({ id: 'form_it', code: 'it', name: 'IT Vocabulary' }))
    expect(bp).toBe(BUILTIN_BLUEPRINTS[FormType.IT])
    expect(bp.coreFields[0].key).toBe('term')
  })

  it('content type seed "Kiến thức chung" (code general) → blueprint General built-in', () => {
    const bp = getBlueprintForContentType(makeCt({ id: 'form_general', code: 'general', name: 'Kiến thức chung' }))
    expect(bp).toBe(BUILTIN_BLUEPRINTS[FormType.GENERAL])
    expect(bp.coreFields[0].key).toBe('title')
  })

  it('content type custom (code test_1) → blueprint dựng từ fields[], không phải built-in', () => {
    const fields: FormFieldConfig[] = [
      { field_key: 'prompt', label: 'Prompt', type: 'text', is_required: true, is_session_persistent: false, sort_order: 1, placeholder: null, data_source: null },
      { field_key: 'answer', label: 'Answer', type: 'textarea', is_required: false, is_session_persistent: false, sort_order: 2, placeholder: null, data_source: null },
    ]
    const bp = getBlueprintForContentType(makeCt({ id: 'auto123', code: 'test_1', name: 'test 1', fields }))
    expect(bp.formType).toBe('test_1')
    expect(bp.uiFormType).toBeUndefined()
    expect(bp.coreFields.map(f => f.key)).toEqual(['prompt', 'answer'])
  })
})
