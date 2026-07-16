import { z } from 'zod'
import {
  CONTENT_TYPE_CODE_PATTERN,
  PROTECTED_GLOBAL_CONTENT_TYPE_IDS,
} from '@/lib/constants'
import { FormType } from '@/types'
import type { ContentType, UserContentType } from '@/types'

export type EditableContentTypeData = Pick<
  ContentType,
  | 'code'
  | 'name'
  | 'description'
  | 'icon'
  | 'fields'
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
      fields: source.fields.map(field => ({ ...field })),
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
    name: 'Ngôn ngữ',
    description: 'Từ vựng tiếng Anh, Trung, Nhật',
    icon: '🌍',
    sort_order: 1,
    default_create_mode: 'batch',
    is_active: true,
    fields: [
      { field_key: 'language', label: 'Ngôn ngữ', type: 'dropdown', is_required: true, is_session_persistent: true, sort_order: 1, data_source: null, placeholder: null },
      { field_key: 'anki_deck', label: 'Anki Deck', type: 'dropdown', is_required: true, is_session_persistent: true, sort_order: 2, data_source: 'decks', placeholder: null },
      { field_key: 'category_id', label: 'Category', type: 'dropdown', is_required: false, is_session_persistent: true, sort_order: 3, data_source: 'categories', placeholder: null },
      { field_key: 'tags', label: 'Tags', type: 'tags', is_required: false, is_session_persistent: true, sort_order: 4, data_source: null, placeholder: 'Thêm tag...' },
      { field_key: 'word', label: 'Từ vựng', type: 'text', is_required: true, is_session_persistent: false, sort_order: 5, data_source: null, placeholder: 'Nhập từ vựng...' },
      { field_key: 'note', label: 'Ghi chú', type: 'text', is_required: false, is_session_persistent: false, sort_order: 6, data_source: null, placeholder: 'Ghi chú cá nhân (optional)' },
      { field_key: 'card_type_ids', label: 'Loại card', type: 'checkbox_group', is_required: false, is_session_persistent: true, sort_order: 7, data_source: 'card_types', placeholder: null },
    ],
  },
  {
    id: FormType.IT,
    code: 'it',
    name: 'IT Vocabulary',
    description: 'Thuật ngữ lập trình, công nghệ',
    icon: '💻',
    sort_order: 2,
    default_create_mode: 'single',
    is_active: true,
    fields: [
      { field_key: 'anki_deck', label: 'Anki Deck', type: 'dropdown', is_required: true, is_session_persistent: true, sort_order: 1, data_source: 'decks', placeholder: null },
      { field_key: 'topic_ids', label: 'Chủ đề', type: 'checkbox_group', is_required: false, is_session_persistent: true, sort_order: 2, data_source: 'topics', placeholder: null },
      { field_key: 'difficulty', label: 'Độ khó', type: 'dropdown', is_required: false, is_session_persistent: true, sort_order: 3, data_source: null, placeholder: null },
      { field_key: 'term', label: 'Thuật ngữ', type: 'text', is_required: true, is_session_persistent: false, sort_order: 4, data_source: null, placeholder: 'Ví dụ: REST API, Docker...' },
      { field_key: 'definition', label: 'Định nghĩa ngắn', type: 'text', is_required: true, is_session_persistent: false, sort_order: 5, data_source: null, placeholder: 'Mô tả ngắn gọn bằng tiếng Việt...' },
      { field_key: 'keywords', label: 'Keywords', type: 'tags', is_required: false, is_session_persistent: false, sort_order: 6, data_source: null, placeholder: 'Thêm keyword liên quan...' },
      { field_key: 'card_type_ids', label: 'Loại card', type: 'checkbox_group', is_required: false, is_session_persistent: true, sort_order: 7, data_source: 'card_types', placeholder: null },
    ],
  },
  {
    id: FormType.GENERAL,
    code: 'general',
    name: 'Kiến thức chung',
    description: 'Bất kỳ nội dung nào khác',
    icon: '📚',
    sort_order: 3,
    default_create_mode: 'single',
    is_active: true,
    fields: [
      { field_key: 'anki_deck', label: 'Anki Deck', type: 'dropdown', is_required: true, is_session_persistent: true, sort_order: 1, data_source: 'decks', placeholder: null },
      { field_key: 'title', label: 'Tiêu đề / Khái niệm', type: 'text', is_required: true, is_session_persistent: false, sort_order: 2, data_source: null, placeholder: 'Nhập tiêu đề...' },
      { field_key: 'content', label: 'Nội dung', type: 'textarea', is_required: true, is_session_persistent: false, sort_order: 3, data_source: null, placeholder: 'Nội dung chi tiết...' },
      { field_key: 'tags', label: 'Tags', type: 'tags', is_required: false, is_session_persistent: false, sort_order: 4, data_source: null, placeholder: 'Thêm tag...' },
    ],
  },
]
