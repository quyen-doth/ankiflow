import type { Firestore } from 'firebase-admin/firestore'
import {
  DEFAULT_CONTENT_TYPES,
  formFieldConfigSchema,
  type ContentTypeSourceDocument,
} from '@/lib/contentTypes'
import {
  GLOBAL_CONTENT_TYPES_COLLECTION,
  USER_CONTENT_TYPES_COLLECTION,
} from '@/lib/constants'
import type { FormFieldConfig } from '@/types'

const OUTPUT_LANGUAGES_DATA_SOURCE = 'output_languages'
const TRANSACTION_CONCURRENCY = 20

export interface OutputLanguageControlBackfillArgs {
  apply: boolean
  help: boolean
  uid?: string
}

export interface OutputLanguageControlBackfillDocument {
  id: string
  data: Record<string, unknown>
}

export type OutputLanguageControlBackfillScope = 'global' | 'user'

export interface OutputLanguageControlBackfillCandidate {
  id: string
  path: string
  scope: OutputLanguageControlBackfillScope
  sourceContentTypeId: string
  desiredField: FormFieldConfig
}

export interface OutputLanguageControlBackfillConflict {
  path: string
  reason: string
}

export interface OutputLanguageControlBackfillPlan {
  scannedGlobal: number
  scannedUser: number
  candidates: OutputLanguageControlBackfillCandidate[]
  conflicts: OutputLanguageControlBackfillConflict[]
  skippedConfigured: number
  skippedUnlinked: number
  skippedWithoutSourceControl: number
}

export interface OutputLanguageControlBackfillFailure {
  path: string
  message: string
}

export interface OutputLanguageControlBackfillResult {
  updated: number
  skippedConfigured: number
  skippedConflicting: number
  failed: OutputLanguageControlBackfillFailure[]
}

type FieldPatchResult =
  | { kind: 'update'; fields: Record<string, unknown>[] }
  | { kind: 'configured' }
  | { kind: 'conflict'; reason: string }

export function parseOutputLanguageControlBackfillArgs(
  args: string[],
): OutputLanguageControlBackfillArgs {
  let apply = false
  let help = false
  let uid: string | undefined

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === '--apply') {
      apply = true
      continue
    }
    if (argument === '--help' || argument === '-h') {
      help = true
      continue
    }
    if (argument === '--uid') {
      const value = args[index + 1]?.trim()
      if (!value || value.startsWith('--')) throw new Error('--uid requires a Firebase Auth UID')
      if (uid) throw new Error('--uid may only be provided once')
      uid = value
      index += 1
      continue
    }
    if (argument.startsWith('--uid=')) {
      const value = argument.slice('--uid='.length).trim()
      if (!value) throw new Error('--uid requires a Firebase Auth UID')
      if (uid) throw new Error('--uid may only be provided once')
      uid = value
      continue
    }
    throw new Error(`Unknown argument: ${argument}`)
  }

  return { apply, help, ...(uid ? { uid } : {}) }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizedString(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLocaleLowerCase('en-US') : ''
}

function cloneField(field: FormFieldConfig): FormFieldConfig {
  return {
    ...field,
    ...(field.options ? { options: field.options.slice() } : {}),
  }
}

function findOutputLanguageControl(
  fields: unknown,
): { field?: FormFieldConfig; invalidReason?: string } {
  if (!Array.isArray(fields)) return {}
  const stored = fields.find(field => (
    isRecord(field)
    && normalizedString(field.data_source) === OUTPUT_LANGUAGES_DATA_SOURCE
  ))
  if (!stored) return {}

  const parsed = formFieldConfigSchema.safeParse(stored)
  if (!parsed.success) {
    return {
      invalidReason: parsed.error.issues
        .map(issue => `${issue.path.join('.')}: ${issue.message}`)
        .join('; '),
    }
  }
  return { field: cloneField(parsed.data) }
}

function insertBySortOrder(
  fields: Record<string, unknown>[],
  desiredField: FormFieldConfig,
): Record<string, unknown>[] {
  const next: Record<string, unknown>[] = fields.map((field): Record<string, unknown> => ({
    ...field,
    ...(Array.isArray(field.options) ? { options: [...field.options] } : {}),
  }))
  const desiredSortOrder = desiredField.sort_order
  const insertAt = next.findIndex(field => (
    typeof field.sort_order === 'number' && field.sort_order >= desiredSortOrder
  ))
  next.splice(insertAt < 0 ? next.length : insertAt, 0, { ...cloneField(desiredField) })
  return next
}

function buildFieldsPatch(
  data: Record<string, unknown>,
  desiredField: FormFieldConfig,
): FieldPatchResult {
  if (!Array.isArray(data.fields) || !data.fields.every(isRecord)) {
    return { kind: 'conflict', reason: 'fields is not a valid object array' }
  }
  const fields: Record<string, unknown>[] = data.fields

  const existingControl = findOutputLanguageControl(fields)
  if (existingControl.invalidReason) {
    return {
      kind: 'conflict',
      reason: `existing output language control is invalid: ${existingControl.invalidReason}`,
    }
  }
  if (existingControl.field) return { kind: 'configured' }

  const desiredKey = normalizedString(desiredField.field_key)
  const keyCollision = fields.some(field => normalizedString(field.field_key) === desiredKey)
  if (keyCollision) {
    return {
      kind: 'conflict',
      reason: `field key "${desiredField.field_key}" already exists without the output_languages data source`,
    }
  }

  return {
    kind: 'update',
    fields: insertBySortOrder(fields, desiredField),
  }
}

function sourceCode(data: Record<string, unknown>): string {
  return normalizedString(data.code)
}

function desiredControlsByDefault(
  defaults: readonly ContentTypeSourceDocument[],
): {
  byId: Map<string, FormFieldConfig>
  byCode: Map<string, FormFieldConfig>
} {
  const byId = new Map<string, FormFieldConfig>()
  const byCode = new Map<string, FormFieldConfig>()
  for (const source of defaults) {
    const control = findOutputLanguageControl(source.fields)
    if (!control.field) continue
    byId.set(source.id, control.field)
    const code = normalizedString(source.code)
    if (code) byCode.set(code, control.field)
  }
  return { byId, byCode }
}

/**
 * Global source と user snapshot の現在値だけから deterministic plan を作る。
 * Content Type の code/form_type を分岐条件にせず、data_source 宣言を source of truth にする。
 */
export function buildOutputLanguageControlBackfillPlan(
  globalDocuments: readonly OutputLanguageControlBackfillDocument[],
  userDocuments: readonly OutputLanguageControlBackfillDocument[],
  defaults: readonly ContentTypeSourceDocument[] = DEFAULT_CONTENT_TYPES,
): OutputLanguageControlBackfillPlan {
  const candidates: OutputLanguageControlBackfillCandidate[] = []
  const conflicts: OutputLanguageControlBackfillConflict[] = []
  let skippedConfigured = 0
  let skippedUnlinked = 0
  let skippedWithoutSourceControl = 0

  const defaultControls = desiredControlsByDefault(defaults)
  const desiredBySourceId = new Map(defaultControls.byId)
  const sortedGlobal = [...globalDocuments].sort((left, right) => left.id.localeCompare(right.id))

  for (const document of sortedGlobal) {
    const path = `${GLOBAL_CONTENT_TYPES_COLLECTION}/${document.id}`
    const storedControl = findOutputLanguageControl(document.data.fields)
    if (storedControl.invalidReason) {
      desiredBySourceId.delete(document.id)
      conflicts.push({
        path,
        reason: `source output language control is invalid: ${storedControl.invalidReason}`,
      })
      continue
    }
    if (storedControl.field) {
      desiredBySourceId.set(document.id, storedControl.field)
      skippedConfigured += 1
      continue
    }

    const desiredField = defaultControls.byId.get(document.id)
      ?? defaultControls.byCode.get(sourceCode(document.data))
    if (!desiredField) {
      desiredBySourceId.delete(document.id)
      skippedWithoutSourceControl += 1
      continue
    }

    const patch = buildFieldsPatch(document.data, desiredField)
    if (patch.kind === 'conflict') {
      desiredBySourceId.delete(document.id)
      conflicts.push({ path, reason: patch.reason })
      continue
    }
    if (patch.kind === 'configured') {
      desiredBySourceId.set(document.id, desiredField)
      skippedConfigured += 1
      continue
    }

    desiredBySourceId.set(document.id, desiredField)
    candidates.push({
      id: document.id,
      path,
      scope: 'global',
      sourceContentTypeId: document.id,
      desiredField: cloneField(desiredField),
    })
  }

  const sortedUser = [...userDocuments].sort((left, right) => left.id.localeCompare(right.id))
  for (const document of sortedUser) {
    const path = `${USER_CONTENT_TYPES_COLLECTION}/${document.id}`
    const sourceContentTypeId = typeof document.data.source_content_type_id === 'string'
      ? document.data.source_content_type_id.trim()
      : ''
    if (!sourceContentTypeId) {
      skippedUnlinked += 1
      continue
    }

    const desiredField = desiredBySourceId.get(sourceContentTypeId)
    if (!desiredField) {
      skippedWithoutSourceControl += 1
      continue
    }

    const patch = buildFieldsPatch(document.data, desiredField)
    if (patch.kind === 'conflict') {
      conflicts.push({ path, reason: patch.reason })
      continue
    }
    if (patch.kind === 'configured') {
      skippedConfigured += 1
      continue
    }

    candidates.push({
      id: document.id,
      path,
      scope: 'user',
      sourceContentTypeId,
      desiredField: cloneField(desiredField),
    })
  }

  return {
    scannedGlobal: globalDocuments.length,
    scannedUser: userDocuments.length,
    candidates,
    conflicts: conflicts.sort((left, right) => left.path.localeCompare(right.path)),
    skippedConfigured,
    skippedUnlinked,
    skippedWithoutSourceControl,
  }
}

export async function fetchOutputLanguageControlBackfillDocuments(
  db: Firestore,
  uid?: string,
): Promise<{
  globalDocuments: OutputLanguageControlBackfillDocument[]
  userDocuments: OutputLanguageControlBackfillDocument[]
}> {
  const userQuery = uid
    ? db.collection(USER_CONTENT_TYPES_COLLECTION).where('user_id', '==', uid)
    : db.collection(USER_CONTENT_TYPES_COLLECTION)
  const [globalSnapshot, userSnapshot] = await Promise.all([
    db.collection(GLOBAL_CONTENT_TYPES_COLLECTION).get(),
    userQuery.get(),
  ])
  return {
    globalDocuments: globalSnapshot.docs.map(document => ({
      id: document.id,
      data: { ...document.data() } as Record<string, unknown>,
    })),
    userDocuments: userSnapshot.docs.map(document => ({
      id: document.id,
      data: { ...document.data() } as Record<string, unknown>,
    })),
  }
}

function chunksOf<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let offset = 0; offset < items.length; offset += size) {
    chunks.push(items.slice(offset, offset + size))
  }
  return chunks
}

function collectionForScope(scope: OutputLanguageControlBackfillScope): string {
  return scope === 'global'
    ? GLOBAL_CONTENT_TYPES_COLLECTION
    : USER_CONTENT_TYPES_COLLECTION
}

/**
 * Apply 時は transaction 内で fields と source link を再確認する。
 * Dry-run 後の user customization と同名 field を上書きしない。
 */
export async function executeOutputLanguageControlBackfill(
  db: Firestore,
  plan: OutputLanguageControlBackfillPlan,
  now = new Date(),
): Promise<OutputLanguageControlBackfillResult> {
  let updated = 0
  let skippedConfigured = 0
  let skippedConflicting = 0
  const failed: OutputLanguageControlBackfillFailure[] = []

  for (const chunk of chunksOf(plan.candidates, TRANSACTION_CONCURRENCY)) {
    await Promise.all(chunk.map(async candidate => {
      try {
        const ref = db.collection(collectionForScope(candidate.scope)).doc(candidate.id)
        const outcome = await db.runTransaction(async transaction => {
          const snapshot = await transaction.get(ref)
          if (!snapshot.exists) throw new Error('Document no longer exists')
          const current = snapshot.data() as Record<string, unknown>
          if (
            candidate.scope === 'user'
            && current.source_content_type_id !== candidate.sourceContentTypeId
          ) {
            return 'conflict' as const
          }
          const patch = buildFieldsPatch(current, candidate.desiredField)
          if (patch.kind === 'configured') return 'configured' as const
          if (patch.kind === 'conflict') return 'conflict' as const
          transaction.update(ref, { fields: patch.fields, updated_at: now })
          return 'updated' as const
        })
        if (outcome === 'updated') updated += 1
        else if (outcome === 'configured') skippedConfigured += 1
        else skippedConflicting += 1
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
    skippedConfigured,
    skippedConflicting,
    failed: failed.sort((left, right) => left.path.localeCompare(right.path)),
  }
}
