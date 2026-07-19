import { z } from 'zod'
import {
  CONTENT_TYPE_CODE_PATTERN,
  PROTECTED_GLOBAL_CONTENT_TYPE_IDS,
} from '@/lib/constants'
import { resolveBuiltinAiOutputProfiles } from '@/lib/ai-agent/builtinOutputProfiles'
import { aiOutputProfilesSchema, cloneAiOutputProfiles } from '@/lib/ai-agent/outputProfiles'
import { FormType } from '@/types'
import type { ContentType, UserContentType } from '@/types'

export type EditableContentTypeData = Pick<
  ContentType,
  | 'code'
  | 'name'
  | 'description'
  | 'icon'
  | 'fields'
  | 'ai_output_profiles'
  | 'is_active'
  | 'sort_order'
  | 'default_create_mode'
>

export interface ContentTypeSeedDefinition extends EditableContentTypeData {
  id: string
}

export interface ContentTypeSourceDocument extends EditableContentTypeData {
  id: string
  user_id?: unknown
  source_content_type_id?: unknown
  created_at?: unknown
  updated_at?: unknown
}

export interface MaterializedUserContentType {
  id: string
  data: Omit<UserContentType, 'id' | 'created_at' | 'updated_at'>
}

export interface ContentTypeValidationIssue {
  path: string
  message: string
}

export interface RuntimeContentTypeLike {
  id: string
  code: string
  is_active: boolean
  sort_order: number
}

export interface RuntimeContentTypePreparation<T extends RuntimeContentTypeLike> {
  contentTypes: T[]
  conflictingCodes: string[]
}

export type ContentTypeValidationResult =
  | { success: true; data: EditableContentTypeData }
  | { success: false; issues: ContentTypeValidationIssue[] }

const fieldTypeSchema = z.enum([
  'text',
  'textarea',
  'dropdown',
  'checkbox_group',
  'tags',
  'number',
])

export const formFieldConfigSchema = z.object({
  field_key: z.string().trim().min(1, 'Field key is required'),
  label: z.string().trim().min(1, 'Field label is required'),
  type: fieldTypeSchema,
  is_required: z.boolean(),
  is_session_persistent: z.boolean(),
  sort_order: z.number().int('Field sort order must be an integer').min(0),
  placeholder: z.string().nullable().optional(),
  data_source: z.string().nullable().optional(),
  options: z.array(z.string().trim().min(1, 'Dropdown options cannot be empty')).optional(),
})

export const editableContentTypeSchema = z.object({
  code: z.string()
    .trim()
    .min(1, 'Content type code is required')
    .regex(CONTENT_TYPE_CODE_PATTERN, 'Content type code must use lowercase snake_case and start with a letter'),
  name: z.string().trim().min(1, 'Content type name is required'),
  description: z.string(),
  icon: z.string(),
  fields: z.array(formFieldConfigSchema),
  ai_output_profiles: aiOutputProfilesSchema.optional(),
  is_active: z.boolean(),
  sort_order: z.number().int('Content type sort order must be an integer').min(0),
  default_create_mode: z.enum(['single', 'batch']).optional(),
}).superRefine((value, ctx) => {
  const seen = new Map<string, number>()
  value.fields.forEach((field, index) => {
    const key = field.field_key.toLocaleLowerCase('en-US')
    const firstIndex = seen.get(key)
    if (firstIndex !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['fields', index, 'field_key'],
        message: `Field key must be unique; it duplicates fields.${firstIndex}.field_key`,
      })
      return
    }
    seen.set(key, index)
  })
})

/** Global source ID と UID から再実行可能な user document ID を作る。 */
export function userContentTypeId(sourceContentTypeId: string, uid: string): string {
  return `${sourceContentTypeId}__${uid}`
}

/** Global Content Type の編集可能な設定だけを user snapshot に materialize する。 */
export function materializeUserContentType(
  source: ContentTypeSourceDocument,
  uid: string,
): MaterializedUserContentType {
  if (!uid.trim()) throw new Error('User ID is required')

  return {
    id: userContentTypeId(source.id, uid),
    data: {
      user_id: uid,
      source_content_type_id: source.id,
      code: source.code,
      name: source.name,
      description: source.description,
      icon: source.icon,
      fields: source.fields.map(field => ({
        ...field,
        ...(field.options ? { options: field.options.slice() } : {}),
      })),
      ...(source.ai_output_profiles
        ? { ai_output_profiles: cloneAiOutputProfiles(source.ai_output_profiles) }
        : {}),
      is_active: source.is_active,
      sort_order: source.sort_order,
      ...(source.default_create_mode ? { default_create_mode: source.default_create_mode } : {}),
    },
  }
}

const BUILTIN_CODE_MAP: Readonly<Record<string, FormType>> = {
  [FormType.LANGUAGE]: FormType.LANGUAGE,
  [FormType.IT]: FormType.IT,
  [FormType.GENERAL]: FormType.GENERAL,
  language: FormType.LANGUAGE,
  it: FormType.IT,
  general: FormType.GENERAL,
}

/** Content Type の code だけを使って built-in FormType を解決する。 */
export function resolveContentTypeFormType(code: string): FormType | null {
  return BUILTIN_CODE_MAP[code] ?? null
}

/** Runtime routing key は user document ID ではなく Content Type code だけから作る。 */
export function resolveRuntimeContentTypeCode(code: string): FormType | string {
  const normalizedCode = code.trim().toLocaleLowerCase('en-US')
  return resolveContentTypeFormType(normalizedCode) ?? normalizedCode
}

/**
 * Workspace snapshot を runtime 表示用に整形する。
 *
 * 重複判定は inactive document も含む workspace 全体に対して行い、built-in alias
 * (`language` / `form_language`) が同じ route に解決される場合も競合として扱う。
 * 競合した route の Content Type は runtime 一覧から除外し (ランダム選択を避ける)、
 * `conflictingCodes` で呼び出し側に警告表示させる。競合していない残りは利用可能。
 */
export function prepareRuntimeContentTypes<T extends RuntimeContentTypeLike>(
  contentTypes: readonly T[],
): RuntimeContentTypePreparation<T> {
  const routingGroups = new Map<string, string[]>()

  for (const contentType of contentTypes) {
    const routingCode = resolveRuntimeContentTypeCode(contentType.code)
    const key = routingCode.toLocaleLowerCase('en-US')
    const codes = routingGroups.get(key) ?? []
    codes.push(contentType.code)
    routingGroups.set(key, codes)
  }

  const conflictingKeys = new Set(
    Array.from(routingGroups.entries())
      .filter(([, codes]) => codes.length > 1)
      .map(([key]) => key),
  )

  const conflictingCodes = Array.from(routingGroups.values())
    .filter(codes => codes.length > 1)
    .flatMap(codes => codes)
    .filter((code, index, codes) => codes.indexOf(code) === index)
    .sort((a, b) => a.localeCompare(b))

  const activeContentTypes = contentTypes
    .filter(contentType => contentType.is_active)
    .filter(contentType => (
      !conflictingKeys.has(resolveRuntimeContentTypeCode(contentType.code).toLocaleLowerCase('en-US'))
    ))
    .slice()
    .sort((a, b) => (
      a.sort_order - b.sort_order
      || a.code.localeCompare(b.code)
      || a.id.localeCompare(b.id)
    ))

  return {
    contentTypes: activeContentTypes,
    conflictingCodes,
  }
}

export function isProtectedGlobalContentTypeId(id: string): boolean {
  return PROTECTED_GLOBAL_CONTENT_TYPE_IDS.some(protectedId => protectedId === id)
}

export function validateContentTypeConfig(
  input: unknown,
  existingCode?: string,
): ContentTypeValidationResult {
  const parsed = editableContentTypeSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      issues: parsed.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    }
  }

  if (existingCode !== undefined && parsed.data.code !== existingCode) {
    return {
      success: false,
      issues: [{ path: 'code', message: 'Content type code cannot be changed after creation' }],
    }
  }

  return { success: true, data: parsed.data }
}

export function parseContentTypeConfig(input: unknown, existingCode?: string): EditableContentTypeData {
  const result = validateContentTypeConfig(input, existingCode)
  if (result.success) return result.data
  throw new Error(result.issues.map(issue => `${issue.path}: ${issue.message}`).join('; '))
}

// Global seed の単一 source。既存 seed と同じ内容を維持する。
export const DEFAULT_CONTENT_TYPES: ContentTypeSeedDefinition[] = [
  {
    id: FormType.LANGUAGE,
    code: 'language',
    name: 'Language',
    description: 'English, Chinese, and Japanese vocabulary',
    icon: '🌍',
    sort_order: 1,
    default_create_mode: 'batch',
    is_active: true,
    ai_output_profiles: resolveBuiltinAiOutputProfiles(FormType.LANGUAGE)!,
    fields: [
      { field_key: 'language', label: 'Language', type: 'dropdown', is_required: true, is_session_persistent: true, sort_order: 1, data_source: null, placeholder: null },
      { field_key: 'anki_deck', label: 'Anki Deck', type: 'dropdown', is_required: true, is_session_persistent: true, sort_order: 2, data_source: 'decks', placeholder: null },
      { field_key: 'category_id', label: 'Category', type: 'dropdown', is_required: false, is_session_persistent: true, sort_order: 3, data_source: 'categories', placeholder: null },
      { field_key: 'tags', label: 'Tags', type: 'tags', is_required: false, is_session_persistent: true, sort_order: 4, data_source: null, placeholder: 'Add a tag...' },
      { field_key: 'word', label: 'Vocabulary item', type: 'text', is_required: true, is_session_persistent: false, sort_order: 5, data_source: null, placeholder: 'Enter a word...' },
      { field_key: 'note', label: 'Note', type: 'text', is_required: false, is_session_persistent: false, sort_order: 6, data_source: null, placeholder: 'Personal note (optional)' },
      { field_key: 'card_type_ids', label: 'Card types', type: 'checkbox_group', is_required: false, is_session_persistent: true, sort_order: 7, data_source: 'card_types', placeholder: null },
    ],
  },
  {
    id: FormType.IT,
    code: 'it',
    name: 'IT Vocabulary',
    description: 'Programming and technology terms',
    icon: '💻',
    sort_order: 2,
    default_create_mode: 'single',
    is_active: true,
    ai_output_profiles: resolveBuiltinAiOutputProfiles(FormType.IT)!,
    fields: [
      { field_key: 'anki_deck', label: 'Anki Deck', type: 'dropdown', is_required: true, is_session_persistent: true, sort_order: 1, data_source: 'decks', placeholder: null },
      { field_key: 'topic_ids', label: 'Topics', type: 'checkbox_group', is_required: false, is_session_persistent: true, sort_order: 2, data_source: 'topics', placeholder: null },
      { field_key: 'difficulty', label: 'Difficulty', type: 'dropdown', is_required: false, is_session_persistent: true, sort_order: 3, data_source: null, placeholder: null },
      { field_key: 'term', label: 'Term', type: 'text', is_required: true, is_session_persistent: false, sort_order: 4, data_source: null, placeholder: 'e.g. REST API, Docker...' },
      { field_key: 'definition', label: 'Short definition', type: 'text', is_required: true, is_session_persistent: false, sort_order: 5, data_source: null, placeholder: 'A brief description...' },
      { field_key: 'keywords', label: 'Keywords', type: 'tags', is_required: false, is_session_persistent: false, sort_order: 6, data_source: null, placeholder: 'Add a related keyword...' },
      { field_key: 'card_type_ids', label: 'Card types', type: 'checkbox_group', is_required: false, is_session_persistent: true, sort_order: 7, data_source: 'card_types', placeholder: null },
    ],
  },
  {
    id: FormType.GENERAL,
    code: 'general',
    name: 'General Knowledge',
    description: 'Any other content',
    icon: '📚',
    sort_order: 3,
    default_create_mode: 'single',
    is_active: true,
    fields: [
      { field_key: 'anki_deck', label: 'Anki Deck', type: 'dropdown', is_required: true, is_session_persistent: true, sort_order: 1, data_source: 'decks', placeholder: null },
      { field_key: 'title', label: 'Title / Concept', type: 'text', is_required: true, is_session_persistent: false, sort_order: 2, data_source: null, placeholder: 'Enter a title...' },
      { field_key: 'content', label: 'Content', type: 'textarea', is_required: true, is_session_persistent: false, sort_order: 3, data_source: null, placeholder: 'Detailed content...' },
      { field_key: 'tags', label: 'Tags', type: 'tags', is_required: false, is_session_persistent: false, sort_order: 4, data_source: null, placeholder: 'Add a tag...' },
    ],
  },
]
