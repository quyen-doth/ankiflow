import { FormType, LanguageType } from '@/types'
import type { ContentType } from '@/types'
import type { SessionState } from '@/lib/session'

/** A single editable field in the "Core content" column. The first one is the primary (required) field. */
export interface CoreField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'dropdown' | 'number'
  placeholder?: string
  hint?: string
  optional?: boolean
  options?: string[]
}

/** A control in the "Configuration" column. `row` lays its children out in a 2-col grid. */
export type ConfigBlock =
  | { kind: 'row'; blocks: ConfigLeaf[] }
  | ConfigLeaf

export type ConfigLeaf =
  | { kind: 'language'; span?: number }
  | { kind: 'deck'; filterByLanguage?: boolean; span?: number }
  | { kind: 'category'; span?: number }
  | { kind: 'tags'; span?: number }
  | { kind: 'cardTypes'; span?: number }
  | { kind: 'topic'; span?: number }
  | { kind: 'difficulty'; span?: number }
  | { kind: 'keywords'; span?: number }

type GenerateStrategy =
  | { mode: 'api'; payload: (values: Record<string, string>, session: SessionState) => Record<string, unknown> }
  | { mode: 'local'; content: (values: Record<string, string>, session: SessionState) => Record<string, unknown> }

/** Declarative description of a create form. One <CardForm> renders any blueprint. */
export interface CardFormBlueprint {
  formType: FormType | string
  /** Drives card-type / category filtering and whether a language is attached to the entry. */
  uiFormType?: 'Language' | 'IT' | 'General'
  coreFields: CoreField[]
  configBlocks: ConfigBlock[]
  info?: string
  generate: GenerateStrategy
}

const csv = (s?: string): string[] | undefined =>
  s ? s.split(',').map(k => k.trim()).filter(Boolean) : undefined

const LANGUAGE_BLUEPRINT: CardFormBlueprint = {
  formType: FormType.LANGUAGE,
  uiFormType: 'Language',
  coreFields: [
    {
      key: 'word',
      label: 'Vocabulary item',
      type: 'text',
      placeholder: 'e.g. ephemeral, 将来, 努力…',
      hint: 'A single word or short phrase. AI will enrich definition, reading, examples & audio.',
    },
    {
      key: 'note',
      label: 'Contextual note',
      type: 'textarea',
      optional: true,
      placeholder: 'Add a sentence or context to disambiguate meaning…',
    },
  ],
  configBlocks: [
    { kind: 'row', blocks: [{ kind: 'language' }, { kind: 'deck', filterByLanguage: true }, { kind: 'category', span: 2 }] },
    { kind: 'tags' },
    { kind: 'cardTypes' },
  ],
  info: 'AI enriches definition, IPA reading, example sentence, translation, collocations, audio & image.',
  generate: {
    mode: 'api',
    payload: (v, s) => ({
      word: v.word,
      form_type: FormType.LANGUAGE,
      language: (s.language as LanguageType) || LanguageType.ENGLISH,
      note: v.note || undefined,
    }),
  },
}

const IT_BLUEPRINT: CardFormBlueprint = {
  formType: FormType.IT,
  uiFormType: 'IT',
  coreFields: [
    {
      key: 'term',
      label: 'Technical term',
      type: 'text',
      placeholder: 'e.g. Event Loop, Closure…',
      hint: 'A term or concept. AI will enrich the definition, a code-context example & related concepts.',
    },
    {
      key: 'definition',
      label: 'Your definition',
      type: 'textarea',
      optional: true,
      placeholder: 'Describe it in your own words…',
    },
  ],
  configBlocks: [{ kind: 'deck' }, { kind: 'topic' }, { kind: 'difficulty' }, { kind: 'keywords' }],
  info: 'AI generates a clear definition, key points, code-context example & related concepts.',
  generate: {
    mode: 'api',
    payload: (v, s) => ({
      term: v.term,
      form_type: FormType.IT,
      topics: s.topicIds || [],
      definition: v.definition || undefined,
      keywords: csv(v.keywords),
    }),
  },
}

const GENERAL_BLUEPRINT: CardFormBlueprint = {
  formType: FormType.GENERAL,
  uiFormType: 'General',
  coreFields: [
    { key: 'title', label: 'Card title', type: 'text', placeholder: 'Front side…' },
    { key: 'content', label: 'Content', type: 'textarea', optional: true, placeholder: 'Back side…' },
  ],
  configBlocks: [{ kind: 'deck' }, { kind: 'tags' }],
  info: 'AI generates a clear definition, key points & a concise example for your card.',
  generate: {
    mode: 'local',
    content: (v) => ({
      title: v.title,
      content: v.content,
      word: v.title,
      meaning_vi: v.content,
    }),
  },
}

export const BUILTIN_BLUEPRINTS: Partial<Record<FormType, CardFormBlueprint>> = {
  [FormType.LANGUAGE]: LANGUAGE_BLUEPRINT,
  [FormType.IT]: IT_BLUEPRINT,
  [FormType.GENERAL]: GENERAL_BLUEPRINT,
}

/**
 * Ánh xạ id/code của content type → FormType built-in.
 * Bao gồm cả giá trị enum (`form_language`...) lẫn alias rút gọn (`language`...)
 * mà seed đã dùng cho `code`, để 3 content type built-in luôn dùng đúng blueprint.
 */
const BUILTIN_ALIASES: Record<string, FormType> = {
  [FormType.LANGUAGE]: FormType.LANGUAGE,
  [FormType.IT]: FormType.IT,
  [FormType.GENERAL]: FormType.GENERAL,
  language: FormType.LANGUAGE,
  it: FormType.IT,
  general: FormType.GENERAL,
}

export function resolveBuiltinFormType(idOrCode: string): FormType | null {
  return BUILTIN_ALIASES[idOrCode] ?? null
}

/** Trả blueprint cho một content type: built-in nếu id/code khớp, ngược lại dựng từ fields[]. */
export function getBlueprintForContentType(ct: ContentType): CardFormBlueprint {
  const ft = resolveBuiltinFormType(ct.id) ?? resolveBuiltinFormType(ct.code)
  if (ft && BUILTIN_BLUEPRINTS[ft]) return BUILTIN_BLUEPRINTS[ft]!
  return blueprintFromContentType(ct)
}

const FIELD_TYPE_MAP: Record<string, CoreField['type']> = {
  text: 'text',
  textarea: 'textarea',
  dropdown: 'dropdown',
  number: 'number',
}

/** Build a blueprint for a Firestore-defined custom content type. */
export function blueprintFromContentType(ct: ContentType): CardFormBlueprint {
  const sorted = [...ct.fields].sort((a, b) => a.sort_order - b.sort_order)
  const coreFields: CoreField[] = sorted.map((f, i) => ({
    key: f.field_key,
    label: f.label,
    type: FIELD_TYPE_MAP[f.type] ?? 'text',
    placeholder: f.placeholder || undefined,
    optional: i > 0 && !f.is_required,
  }))

  return {
    formType: ct.code,
    coreFields,
    configBlocks: [{ kind: 'deck' }, { kind: 'tags' }],
    generate: {
      mode: 'api',
      payload: (v) => ({
        word: coreFields[0] ? v[coreFields[0].key] : '',
        form_type: ct.code,
        contentTypeName: ct.name,
        dynamicFields: v,
      }),
    },
  }
}
