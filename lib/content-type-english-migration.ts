import type { Firestore } from 'firebase-admin/firestore'
import {
  DEFAULT_CONTENT_TYPES,
  resolveContentTypeFormType,
  type ContentTypeSeedDefinition,
} from '@/lib/contentTypes'
import {
  GLOBAL_CONTENT_TYPES_COLLECTION,
  USER_CONTENT_TYPES_COLLECTION,
} from '@/lib/constants'
import { FormType } from '@/types'

const TRANSACTION_CONCURRENCY = 20
const MIGRATABLE_BUILTIN_CODES = [
  'language',
  FormType.LANGUAGE,
  'it',
  FormType.IT,
  'general',
  FormType.GENERAL,
] as const

interface LegacyFieldText {
  label?: string
  placeholder?: string
}

interface LegacyBuiltinText {
  name?: string
  description?: string
  fields: Readonly<Record<string, LegacyFieldText>>
}

const LEGACY_BUILTIN_TEXT: Readonly<Record<FormType, LegacyBuiltinText>> = {
  [FormType.LANGUAGE]: {
    name: 'Ngôn ngữ',
    description: 'Từ vựng tiếng Anh, Trung, Nhật',
    fields: {
      language: { label: 'Ngôn ngữ' },
      tags: { placeholder: 'Thêm tag...' },
      word: { label: 'Từ vựng', placeholder: 'Nhập từ vựng...' },
      note: { label: 'Ghi chú', placeholder: 'Ghi chú cá nhân (optional)' },
      card_type_ids: { label: 'Loại card' },
    },
  },
  [FormType.IT]: {
    description: 'Thuật ngữ lập trình, công nghệ',
    fields: {
      topic_ids: { label: 'Chủ đề' },
      difficulty: { label: 'Độ khó' },
      term: { label: 'Thuật ngữ', placeholder: 'Ví dụ: REST API, Docker...' },
      definition: {
        label: 'Định nghĩa ngắn',
        placeholder: 'Mô tả ngắn gọn bằng tiếng Việt...',
      },
      keywords: { placeholder: 'Thêm keyword liên quan...' },
      card_type_ids: { label: 'Loại card' },
    },
  },
  [FormType.GENERAL]: {
    name: 'Kiến thức chung',
    description: 'Bất kỳ nội dung nào khác',
    fields: {
      title: { label: 'Tiêu đề / Khái niệm', placeholder: 'Nhập tiêu đề...' },
      content: { label: 'Nội dung', placeholder: 'Nội dung chi tiết...' },
      tags: { placeholder: 'Thêm tag...' },
    },
  },
}

const DEFAULT_BY_FORM_TYPE = new Map<FormType, ContentTypeSeedDefinition>(
  DEFAULT_CONTENT_TYPES.map(contentType => [
    resolveContentTypeFormType(contentType.code)!,
    contentType,
  ]),
)

export type ContentTypeEnglishMigrationScope = 'global' | 'user'

export interface ContentTypeEnglishMigrationArgs {
  apply: boolean
  help: boolean
}

export interface ContentTypeEnglishMigrationDocument {
  id: string
  scope: ContentTypeEnglishMigrationScope
  data: Record<string, unknown>
}

export interface ContentTypeEnglishPatch {
  formType: FormType
  update: Record<string, unknown>
  changes: string[]
}

export interface ContentTypeEnglishMigrationCandidate extends ContentTypeEnglishPatch {
  id: string
  path: string
  scope: ContentTypeEnglishMigrationScope
}

export interface ContentTypeEnglishMigrationPlan {
  scannedGlobal: number
  scannedUser: number
  candidates: ContentTypeEnglishMigrationCandidate[]
  skippedAlreadyEnglish: number
  skippedCustomized: number
  skippedUnsupported: number
  skippedCustomizedPaths: string[]
  skippedUnsupportedPaths: string[]
}

export interface ContentTypeEnglishMigrationFailure {
  path: string
  message: string
}

export interface ContentTypeEnglishMigrationResult {
  updated: number
  skippedAfterReread: number
  failed: ContentTypeEnglishMigrationFailure[]
}

export function parseContentTypeEnglishMigrationArgs(
  args: string[],
): ContentTypeEnglishMigrationArgs {
  const allowed = new Set(['--apply', '--help', '-h'])
  const unknown = args.filter(arg => !allowed.has(arg))
  if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`)
  return {
    apply: args.includes('--apply'),
    help: args.includes('--help') || args.includes('-h'),
  }
}

function collectionForScope(scope: ContentTypeEnglishMigrationScope): string {
  return scope === 'global'
    ? GLOBAL_CONTENT_TYPES_COLLECTION
    : USER_CONTENT_TYPES_COLLECTION
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneField(field: Record<string, unknown>): Record<string, unknown> {
  return {
    ...field,
    ...(Array.isArray(field.options) ? { options: [...field.options] } : {}),
  }
}

function desiredDefinition(formType: FormType): ContentTypeSeedDefinition | null {
  return DEFAULT_BY_FORM_TYPE.get(formType) ?? null
}

function isEnglishBuiltinMetadata(
  data: Record<string, unknown>,
  formType: FormType,
): boolean {
  const desired = desiredDefinition(formType)
  if (!desired || data.name !== desired.name || data.description !== desired.description) return false
  const fields = data.fields
  if (!Array.isArray(fields)) return false

  return desired.fields.every(desiredField => {
    const current = fields.find((field: unknown) => (
      isRecord(field) && field.field_key === desiredField.field_key
    ))
    if (!isRecord(current) || current.label !== desiredField.label) return false
    const currentPlaceholder = current.placeholder ?? null
    const desiredPlaceholder = desiredField.placeholder ?? null
    return currentPlaceholder === desiredPlaceholder
  })
}

/** 既知の旧ベトナム語デフォルトと完全一致する値だけを英語へ置換する。 */
export function buildContentTypeEnglishPatch(
  data: Record<string, unknown>,
): ContentTypeEnglishPatch | null {
  const code = typeof data.code === 'string' ? data.code : ''
  const formType = resolveContentTypeFormType(code)
  if (!formType) return null

  const desired = desiredDefinition(formType)
  const legacy = LEGACY_BUILTIN_TEXT[formType]
  if (!desired) return null

  const update: Record<string, unknown> = {}
  const changes: string[] = []

  if (legacy.name !== undefined && data.name === legacy.name) {
    update.name = desired.name
    changes.push('name')
  }
  if (legacy.description !== undefined && data.description === legacy.description) {
    update.description = desired.description
    changes.push('description')
  }

  if (Array.isArray(data.fields)) {
    let fieldsChanged = false
    const nextFields = data.fields.map(field => {
      if (!isRecord(field)) return field
      const next = cloneField(field)
      const fieldKey = typeof field.field_key === 'string' ? field.field_key : ''
      const legacyField = legacy.fields[fieldKey]
      const desiredField = desired.fields.find(item => item.field_key === fieldKey)
      if (!legacyField || !desiredField) return next

      if (legacyField.label !== undefined && field.label === legacyField.label) {
        next.label = desiredField.label
        changes.push(`fields.${fieldKey}.label`)
        fieldsChanged = true
      }
      if (
        legacyField.placeholder !== undefined
        && field.placeholder === legacyField.placeholder
      ) {
        next.placeholder = desiredField.placeholder ?? null
        changes.push(`fields.${fieldKey}.placeholder`)
        fieldsChanged = true
      }
      return next
    })
    if (fieldsChanged) update.fields = nextFields
  }

  return changes.length > 0 ? { formType, update, changes } : null
}

/** 入力を変更せず、global/user built-ins の deterministic migration plan を作る。 */
export function buildContentTypeEnglishMigrationPlan(
  documents: readonly ContentTypeEnglishMigrationDocument[],
): ContentTypeEnglishMigrationPlan {
  const candidates: ContentTypeEnglishMigrationCandidate[] = []
  let skippedAlreadyEnglish = 0
  let skippedCustomized = 0
  let skippedUnsupported = 0
  const skippedCustomizedPaths: string[] = []
  const skippedUnsupportedPaths: string[] = []

  const sorted = [...documents].sort((left, right) => (
    left.scope.localeCompare(right.scope) || left.id.localeCompare(right.id)
  ))

  for (const document of sorted) {
    const code = typeof document.data.code === 'string' ? document.data.code : ''
    const formType = resolveContentTypeFormType(code)
    if (!formType) {
      skippedUnsupported += 1
      skippedUnsupportedPaths.push(`${collectionForScope(document.scope)}/${document.id}`)
      continue
    }

    const patch = buildContentTypeEnglishPatch(document.data)
    if (patch) {
      candidates.push({
        ...patch,
        id: document.id,
        path: `${collectionForScope(document.scope)}/${document.id}`,
        scope: document.scope,
      })
      continue
    }

    if (isEnglishBuiltinMetadata(document.data, formType)) {
      skippedAlreadyEnglish += 1
    } else {
      skippedCustomized += 1
      skippedCustomizedPaths.push(`${collectionForScope(document.scope)}/${document.id}`)
    }
  }

  return {
    scannedGlobal: documents.filter(document => document.scope === 'global').length,
    scannedUser: documents.filter(document => document.scope === 'user').length,
    candidates,
    skippedAlreadyEnglish,
    skippedCustomized,
    skippedUnsupported,
    skippedCustomizedPaths,
    skippedUnsupportedPaths,
  }
}

/** Built-in aliases だけを両 collection から並列取得する。 */
export async function fetchContentTypeEnglishMigrationDocuments(
  db: Firestore,
): Promise<ContentTypeEnglishMigrationDocument[]> {
  const [globalSnapshot, userSnapshot] = await Promise.all([
    db.collection(GLOBAL_CONTENT_TYPES_COLLECTION)
      .where('code', 'in', [...MIGRATABLE_BUILTIN_CODES])
      .get(),
    db.collection(USER_CONTENT_TYPES_COLLECTION)
      .where('code', 'in', [...MIGRATABLE_BUILTIN_CODES])
      .get(),
  ])

  return [
    ...globalSnapshot.docs.map(document => ({
      id: document.id,
      scope: 'global' as const,
      data: { ...document.data() } as Record<string, unknown>,
    })),
    ...userSnapshot.docs.map(document => ({
      id: document.id,
      scope: 'user' as const,
      data: { ...document.data() } as Record<string, unknown>,
    })),
  ]
}

function chunksOf<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let offset = 0; offset < items.length; offset += size) {
    chunks.push(items.slice(offset, offset + size))
  }
  return chunks
}

/** Apply 時は transaction 内で再計算し、dry-run 後の customization を上書きしない。 */
export async function executeContentTypeEnglishMigration(
  db: Firestore,
  plan: ContentTypeEnglishMigrationPlan,
  now = new Date(),
): Promise<ContentTypeEnglishMigrationResult> {
  let updated = 0
  let skippedAfterReread = 0
  const failed: ContentTypeEnglishMigrationFailure[] = []

  for (const chunk of chunksOf(plan.candidates, TRANSACTION_CONCURRENCY)) {
    await Promise.all(chunk.map(async candidate => {
      try {
        const ref = db.collection(collectionForScope(candidate.scope)).doc(candidate.id)
        const outcome = await db.runTransaction(async transaction => {
          const snapshot = await transaction.get(ref)
          if (!snapshot.exists) throw new Error('Document no longer exists')
          const current = snapshot.data() as Record<string, unknown>
          const patch = buildContentTypeEnglishPatch(current)
          if (!patch || patch.formType !== candidate.formType) return 'skipped' as const
          transaction.update(ref, { ...patch.update, updated_at: now })
          return 'updated' as const
        })
        if (outcome === 'updated') updated += 1
        else skippedAfterReread += 1
      } catch (error) {
        failed.push({
          path: candidate.path,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }))
  }

  return {
    updated,
    skippedAfterReread,
    failed: failed.sort((left, right) => left.path.localeCompare(right.path)),
  }
}
