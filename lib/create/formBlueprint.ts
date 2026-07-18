import { FormType } from '@/types'
import { resolveContentTypeFormType } from '@/lib/contentTypes'
import type { ContentType, FormFieldConfig } from '@/types'
import type { SessionState } from '@/lib/session'

/** A single editable field in the "Core content" column. The first one is the primary (required) field. */
export interface CoreField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'dropdown' | 'number'
  placeholder?: string
  hint?: string
  optional?: boolean
  required?: boolean
  persistent?: boolean
  options?: string[]
}

interface ConfigFieldMeta {
  fieldKey?: string
  label?: string
  placeholder?: string
  required?: boolean
  persistent?: boolean
}

/** A control in the "Configuration" column. `row` lays its children out in a 2-col grid. */
export type ConfigBlock =
  | { kind: 'row'; blocks: ConfigLeaf[] }
  | ConfigLeaf

export type ConfigLeaf = ConfigFieldMeta & (
  | { kind: 'language'; span?: number }
  | { kind: 'deck'; filterByLanguage?: boolean; span?: number }
  | { kind: 'category'; span?: number }
  | { kind: 'tags'; span?: number }
  | { kind: 'cardTypes'; span?: number }
  | { kind: 'topic'; span?: number }
  | { kind: 'difficulty'; span?: number }
  | { kind: 'keywords'; span?: number }
)

type GenerateStrategy =
  | { mode: 'api'; payload: (values: Record<string, string>, session: SessionState) => Record<string, unknown> }
  | { mode: 'local'; content: (values: Record<string, string>, session: SessionState) => Record<string, unknown> }

/** Declarative description of a create form. One <CardForm> renders any blueprint. */
export interface CardFormBlueprint {
  formType: FormType | string
  /** Drives card-type / category filtering and whether a language is attached to the entry. */
  uiFormType?: 'Language' | 'IT' | 'General'
  /** Duplicate detection/batch generation の主入力。表示順とは独立。 */
  primaryFieldKey?: string
  coreFields: CoreField[]
  configBlocks: ConfigBlock[]
  info?: string
  generate: GenerateStrategy
}

/** Bề rộng ưa thích của mỗi control trong lưới 2 cột của cột Configuration. */
const CONTROL_SPAN: Record<ConfigLeaf['kind'], 1 | 2> = {
  language: 1,
  deck: 1,
  difficulty: 1,
  category: 2,
  tags: 2,
  cardTypes: 2,
  topic: 2,
  keywords: 2,
}

/**
 * Nhóm các leaf thành block để render, tôn trọng thứ tự sort_order:
 * - Các leaf span-1 liền kề được ghép thành từng CẶP → `row` (2 cột).
 * - Leaf span-1 lẻ/đơn độc → block full width (không để nửa dòng trơ trọi).
 * - Leaf span-2 → luôn là block full width riêng.
 */
export function groupConfigLeaves(leaves: ConfigLeaf[]): ConfigBlock[] {
  const blocks: ConfigBlock[] = []
  let pending: ConfigLeaf[] = []

  const flushPending = () => {
    for (let i = 0; i < pending.length; i += 2) {
      const pair = pending.slice(i, i + 2)
      blocks.push(pair.length === 2 ? { kind: 'row', blocks: pair } : pair[0])
    }
    pending = []
  }

  for (const leaf of leaves) {
    if (CONTROL_SPAN[leaf.kind] === 1) {
      pending.push(leaf)
      continue
    }
    flushPending()
    blocks.push(leaf)
  }
  flushPending()

  return blocks
}

const csv = (s?: string): string[] | undefined =>
  s ? s.split(',').map(k => k.trim()).filter(Boolean) : undefined

function dynamicValues(values: Record<string, string>, excludedKeys: string[]): Record<string, string> | undefined {
  const excluded = new Set(excludedKeys)
  const entries = Object.entries(values).filter(([key, value]) => !excluded.has(key) && value.trim())
  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

const LANGUAGE_BLUEPRINT: CardFormBlueprint = {
  formType: FormType.LANGUAGE,
  uiFormType: 'Language',
  primaryFieldKey: 'word',
  coreFields: [
    {
      key: 'word',
      label: 'Vocabulary item',
      type: 'text',
      placeholder: 'e.g. ephemeral, 将来, 努力…',
      hint: 'A single word or short phrase. AI will enrich definition, reading, examples & audio.',
      required: true,
      persistent: false,
    },
    {
      key: 'note',
      label: 'Contextual note',
      type: 'textarea',
      optional: true,
      required: false,
      persistent: false,
      placeholder: 'Add a sentence or context to disambiguate meaning…',
    },
  ],
  configBlocks: [
    { kind: 'row', blocks: [
      { kind: 'language', fieldKey: 'language', label: 'Language', required: true, persistent: true },
      { kind: 'deck', fieldKey: 'anki_deck', label: 'Anki Deck', required: true, persistent: true, filterByLanguage: true },
    ] },
    { kind: 'category', fieldKey: 'category_id', label: 'Category', persistent: true },
    { kind: 'tags', fieldKey: 'tags', label: 'Tags', persistent: true },
    { kind: 'cardTypes', fieldKey: 'card_type_ids', label: 'Card types to generate', persistent: true },
  ],
  info: 'AI enriches definition, IPA reading, example sentence, translation, collocations, audio & image.',
  generate: {
    mode: 'api',
    payload: (v, s) => ({
      word: v.word,
      form_type: FormType.LANGUAGE,
      language: s.language,
      language_name: s.languageName,
      output_language: s.outputLanguage,
      output_language_name: s.outputLanguageName,
      note: v.note || undefined,
      dynamicFields: dynamicValues(v, ['word']),
    }),
  },
}

const IT_BLUEPRINT: CardFormBlueprint = {
  formType: FormType.IT,
  uiFormType: 'IT',
  primaryFieldKey: 'term',
  coreFields: [
    {
      key: 'term',
      label: 'Technical term',
      type: 'text',
      placeholder: 'e.g. Event Loop, Closure…',
      hint: 'A term or concept. AI will enrich the definition, a code-context example & related concepts.',
      required: true,
      persistent: false,
    },
    {
      key: 'definition',
      label: 'Your definition',
      type: 'textarea',
      optional: true,
      required: false,
      persistent: false,
      placeholder: 'Describe it in your own words…',
    },
  ],
  configBlocks: [
    { kind: 'deck', fieldKey: 'anki_deck', label: 'Anki Deck', required: true, persistent: true },
    { kind: 'topic', fieldKey: 'topic_ids', label: 'Topics', persistent: true },
    { kind: 'difficulty', fieldKey: 'difficulty', label: 'Difficulty', persistent: true },
    { kind: 'keywords', fieldKey: 'keywords', label: 'Keywords' },
  ],
  info: 'AI generates a clear definition, key points, code-context example & related concepts.',
  generate: {
    mode: 'api',
    payload: (v, s) => ({
      term: v.term,
      form_type: FormType.IT,
      topics: s.topicNames || [],
      output_language: s.outputLanguage,
      output_language_name: s.outputLanguageName,
      definition: v.definition || undefined,
      keywords: csv(v.keywords),
      dynamicFields: dynamicValues(v, ['term']),
    }),
  },
}

const GENERAL_BLUEPRINT: CardFormBlueprint = {
  formType: FormType.GENERAL,
  uiFormType: 'General',
  primaryFieldKey: 'title',
  coreFields: [
    { key: 'title', label: 'Card title', type: 'text', placeholder: 'Front side…', required: true, persistent: false },
    { key: 'content', label: 'Content', type: 'textarea', optional: true, placeholder: 'Back side…', required: false, persistent: false },
  ],
  configBlocks: [
    { kind: 'deck', fieldKey: 'anki_deck', label: 'Anki Deck', required: true, persistent: true },
    { kind: 'tags', fieldKey: 'tags', label: 'Tags' },
  ],
  info: 'AI generates a clear definition, key points & a concise example for your card.',
  generate: {
    mode: 'local',
    content: (v) => ({
      ...v,
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
 * content type の id/code → built-in FormType へのマッピング。
 * enum の値 (`form_language`...) と、seed が `code` に使用した省略 alias
 * (`language`...) の両方を含み、3 つの built-in content type が常に
 * 正しい blueprint を使うようにする。
 */
export function resolveBuiltinFormType(idOrCode: string): FormType | null {
  return resolveContentTypeFormType(idOrCode)
}

export interface ContentTypeBlueprintSource {
  code: string
  name: string
  fields: FormFieldConfig[]
}

export type ContentTypeBlueprintValidationResult =
  | { success: true }
  | { success: false; error: string }

const FIELD_TYPE_MAP: Partial<Record<FormFieldConfig['type'], CoreField['type']>> = {
  text: 'text',
  textarea: 'textarea',
  dropdown: 'dropdown',
  number: 'number',
}

interface ControlDefinition {
  kind: ConfigLeaf['kind']
  types: FormFieldConfig['type'][]
  dataSources: string[]
}

const CONTROL_FIELDS: Readonly<Record<string, ControlDefinition>> = {
  language: { kind: 'language', types: ['dropdown'], dataSources: [] },
  anki_deck: { kind: 'deck', types: ['dropdown'], dataSources: ['decks'] },
  decks: { kind: 'deck', types: ['dropdown'], dataSources: ['decks'] },
  category_id: { kind: 'category', types: ['dropdown'], dataSources: ['categories'] },
  categories: { kind: 'category', types: ['dropdown'], dataSources: ['categories'] },
  tags: { kind: 'tags', types: ['tags'], dataSources: [] },
  card_type_ids: { kind: 'cardTypes', types: ['checkbox_group'], dataSources: ['card_types'] },
  card_types: { kind: 'cardTypes', types: ['checkbox_group'], dataSources: ['card_types'] },
  topic_ids: { kind: 'topic', types: ['checkbox_group'], dataSources: ['topics'] },
  topics: { kind: 'topic', types: ['checkbox_group'], dataSources: ['topics'] },
  difficulty: { kind: 'difficulty', types: ['dropdown'], dataSources: [] },
  keywords: { kind: 'keywords', types: ['tags', 'text'], dataSources: [] },
}

const BUILTIN_PRIMARY_FIELDS: Readonly<Partial<Record<FormType, string>>> = {
  [FormType.LANGUAGE]: 'word',
  [FormType.IT]: 'term',
  [FormType.GENERAL]: 'title',
}

interface BlueprintLayout {
  coreFields: CoreField[]
  configBlocks: ConfigBlock[]
  primaryFieldKey: string
}

function fieldError(field: FormFieldConfig, message: string): Error {
  return new Error(`Field "${field.field_key || '(unnamed)'}": ${message}`)
}

function buildBlueprintLayout(source: ContentTypeBlueprintSource): BlueprintLayout {
  const builtInFormType = resolveBuiltinFormType(source.code)
  const sorted = source.fields.slice().sort((left, right) => left.sort_order - right.sort_order)
  const seenKeys = new Set<string>()
  const seenControls = new Set<ConfigLeaf['kind']>()
  const coreFields: CoreField[] = []
  const configLeaves: ConfigLeaf[] = []

  for (const field of sorted) {
    const key = field.field_key.trim()
    const normalizedKey = key.toLocaleLowerCase('en-US')
    if (!key) throw fieldError(field, 'field key is required.')
    if (!field.label.trim()) throw fieldError(field, 'label is required.')
    if (seenKeys.has(normalizedKey)) throw fieldError(field, 'field key must be unique.')
    seenKeys.add(normalizedKey)

    const control = CONTROL_FIELDS[normalizedKey]
    const dataSource = field.data_source?.trim() || ''
    if (control) {
      if (seenControls.has(control.kind)) {
        throw fieldError(field, `duplicates the "${control.kind}" configuration control.`)
      }
      seenControls.add(control.kind)
      if (!control.types.includes(field.type)) {
        throw fieldError(field, `type "${field.type}" is not supported for this configuration control.`)
      }
      if (dataSource && !control.dataSources.includes(dataSource)) {
        throw fieldError(field, `data source "${dataSource}" is not supported for this configuration control.`)
      }
      configLeaves.push({
        kind: control.kind,
        fieldKey: key,
        label: field.label,
        placeholder: field.placeholder || undefined,
        required: field.is_required,
        persistent: field.is_session_persistent,
        ...(control.kind === 'deck' && builtInFormType === FormType.LANGUAGE
          ? { filterByLanguage: true }
          : {}),
      } as ConfigLeaf)
      continue
    }

    const coreType = FIELD_TYPE_MAP[field.type]
    if (!coreType) {
      throw fieldError(field, `type "${field.type}" is not supported as a core input.`)
    }
    if (dataSource) {
      throw fieldError(field, `data source "${dataSource}" is not supported for a custom core input.`)
    }
    if (coreType === 'dropdown' && (!field.options || field.options.length === 0)) {
      throw fieldError(field, 'custom dropdown must define at least one static option.')
    }
    coreFields.push({
      key,
      label: field.label,
      type: coreType,
      placeholder: field.placeholder || undefined,
      optional: !field.is_required,
      required: field.is_required,
      persistent: field.is_session_persistent,
      options: field.options?.slice(),
    })
  }

  const primaryFieldKey = builtInFormType
    ? BUILTIN_PRIMARY_FIELDS[builtInFormType]
    : coreFields[0]?.key
  if (!primaryFieldKey) {
    throw new Error('Custom Content Type must define at least one supported core input field.')
  }
  if (!coreFields.some(field => field.key === primaryFieldKey)) {
    throw new Error(`Built-in Content Type "${source.code}" must define the "${primaryFieldKey}" core field.`)
  }
  if (builtInFormType === FormType.LANGUAGE
    && !configLeaves.some(leaf => leaf.kind === 'language')) {
    throw new Error('Built-in Language Content Type must define the "language" configuration field.')
  }

  return { coreFields, configBlocks: groupConfigLeaves(configLeaves), primaryFieldKey }
}

export function validateContentTypeBlueprint(
  source: ContentTypeBlueprintSource,
): ContentTypeBlueprintValidationResult {
  try {
    buildBlueprintLayout(source)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid Content Type field configuration.',
    }
  }
}

/** content type の blueprint を返す: code で strategy を選び、fields[] で UI を構築する。 */
export function getBlueprintForContentType(ct: ContentType): CardFormBlueprint {
  return blueprintFromContentType(ct)
}

/** Firestore fields[] から built-in/custom 共通の blueprint を構築する。 */
export function blueprintFromContentType(ct: ContentType): CardFormBlueprint {
  const builtInFormType = resolveBuiltinFormType(ct.code)
  const layout = buildBlueprintLayout(ct)
  const builtIn = builtInFormType ? BUILTIN_BLUEPRINTS[builtInFormType] : undefined

  if (builtIn) {
    return {
      ...builtIn,
      primaryFieldKey: layout.primaryFieldKey,
      coreFields: layout.coreFields,
      configBlocks: layout.configBlocks,
    }
  }

  return {
    formType: ct.code,
    primaryFieldKey: layout.primaryFieldKey,
    coreFields: layout.coreFields,
    configBlocks: layout.configBlocks,
    generate: {
      mode: 'api',
      payload: (v, s) => ({
        word: v[layout.primaryFieldKey] || '',
        form_type: ct.code,
        output_language: s.outputLanguage,
        output_language_name: s.outputLanguageName,
        contentTypeName: ct.name,
        dynamicFields: v,
      }),
    },
  }
}
