import { z } from 'zod'
import { GrpcStatus, type Firestore } from 'firebase-admin/firestore'
import type { Auth } from 'firebase-admin/auth'
import { DEFAULT_TEMPLATES } from '@/lib/anki/renderCard'
import { cardTemplateSchema } from '@/lib/anki/cardFieldSource'
import { DEFAULTS_OWNER_ID } from '@/lib/constants'
import {
  materializeUserDefaultDocument,
  userScopedId,
  type UserDefaultReferenceIds,
} from '@/lib/seed-defaults'
import { FormType } from '@/types'

export const ADMIN_DEFAULT_COLLECTIONS = ['categories', 'card_types', 'topics', 'decks'] as const

export type AdminDefaultCollection = (typeof ADMIN_DEFAULT_COLLECTIONS)[number]

export interface AdminWorkspaceDocument {
  id: string
  data: Record<string, unknown>
}

export type AdminWorkspaceSnapshot = Record<AdminDefaultCollection, AdminWorkspaceDocument[]>

export interface DefaultTemplateDocument {
  id: string
  data: Record<string, unknown>
}

export type DefaultTemplateSnapshot = Record<AdminDefaultCollection, DefaultTemplateDocument[]>

export interface TemplateWriteOperation extends DefaultTemplateDocument {
  collection: AdminDefaultCollection
  createdAt?: unknown
}

export interface TemplateDeleteOperation {
  collection: AdminDefaultCollection
  id: string
}

export interface TemplateSyncPlan {
  creates: TemplateWriteOperation[]
  updates: TemplateWriteOperation[]
  deletes: TemplateDeleteOperation[]
}

export interface SyncAdminDefaultsArgs {
  apply: boolean
  allowEmpty: boolean
  help: boolean
}

export interface UserBackfillOperation extends DefaultTemplateDocument {
  collection: AdminDefaultCollection
  userId: string
}

export interface UserBackfillPlan {
  targetUserCount: number
  creates: UserBackfillOperation[]
}

export interface UserBackfillExecutionResult {
  created: number
  skippedExisting: number
}

const formTypeSchema = z.enum([FormType.LANGUAGE, FormType.IT, FormType.GENERAL])
const nullableLanguageSchema = z.string().min(1).nullable().optional().transform((value) => value ?? null)

const categorySchema = z.object({
  name: z.string().min(1),
  form_type: formTypeSchema,
  sort_order: z.number().finite(),
  is_active: z.boolean(),
})

const cardTypeSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().default(''),
  form_type: formTypeSchema,
  language: nullableLanguageSchema,
  is_default: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.number().finite(),
  template: cardTemplateSchema.optional(),
})

const topicSchema = z.object({
  name: z.string().min(1),
  form_type: formTypeSchema,
  is_active: z.boolean(),
  sort_order: z.number().finite(),
})

const deckSchema = z.object({
  anki_deck_name: z.string().min(1),
  display_name: z.string().min(1),
  form_type: formTypeSchema,
  language: nullableLanguageSchema,
  default_card_type_ids: z.array(z.string()),
  default_category_id: z.string().nullable().optional().transform((value) => value ?? null),
  is_active: z.boolean(),
  sort_order: z.number().finite(),
})

type IdMap = Map<string, string>

/** Admin の user-scoped ID を template ID に戻す。手動作成 doc のランダム ID はそのまま保持。 */
export function templateIdFromAdminId(documentId: string, adminUid: string): string {
  if (!documentId) throw new Error('Document ID must not be empty')
  if (!adminUid) throw new Error('Admin UID must not be empty')

  const suffix = `__${adminUid}`
  if (!documentId.endsWith(suffix)) return documentId

  const templateId = documentId.slice(0, -suffix.length)
  if (!templateId) throw new Error(`Document ID "${documentId}" has no base ID before the admin suffix`)
  return templateId
}

function buildIdMap(
  collection: AdminDefaultCollection,
  documents: AdminWorkspaceDocument[],
  adminUid: string,
): IdMap {
  const result = new Map<string, string>()
  const seenTemplateIds = new Map<string, string>()

  for (const document of documents) {
    const templateId = templateIdFromAdminId(document.id, adminUid)
    const existingSourceId = seenTemplateIds.get(templateId)
    if (existingSourceId) {
      throw new Error(
        `${collection}: source IDs "${existingSourceId}" and "${document.id}" both map to template ID "${templateId}"`,
      )
    }
    seenTemplateIds.set(templateId, document.id)
    result.set(document.id, templateId)
  }

  return result
}

function parseDocument<T>(
  collection: AdminDefaultCollection,
  document: AdminWorkspaceDocument,
  schema: z.ZodType<T>,
): T {
  const parsed = schema.safeParse(document.data)
  if (parsed.success) return parsed.data

  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || 'document'}: ${issue.message}`)
    .join('; ')
  throw new Error(`${collection}/${document.id} is invalid: ${details}`)
}

function withTemplateOwner(data: Record<string, unknown>): Record<string, unknown> {
  return { ...data, user_id: DEFAULTS_OWNER_ID }
}

function parseCardTypeDocument(document: AdminWorkspaceDocument): Record<string, unknown> {
  const parsed = parseDocument('card_types', document, cardTypeSchema)
  const template = parsed.template ?? DEFAULT_TEMPLATES[parsed.code]
  if (!template) {
    throw new Error(`card_types/${document.id} is invalid: template is missing and code "${parsed.code}" has no fallback`)
  }
  return { ...parsed, template }
}

function referenceAliases(idMap: IdMap): IdMap {
  const aliases = new Map(idMap)
  for (const templateId of idMap.values()) aliases.set(templateId, templateId)
  return aliases
}

function resolveReference(
  referenceId: string,
  aliases: IdMap,
  targetCollection: 'categories' | 'card_types',
  deckId: string,
): string {
  const resolved = aliases.get(referenceId)
  if (resolved) return resolved
  throw new Error(`decks/${deckId} references missing ${targetCollection} document "${referenceId}"`)
}

/**
 * Admin の "My workspace" を新規ユーザー用 template snapshot に変換する。
 * 全 validation と FK remap を同期的に完了するため、呼び出し側は成功後だけ write を開始できる。
 */
export function buildAdminDefaultSnapshot(
  source: AdminWorkspaceSnapshot,
  adminUid: string,
): DefaultTemplateSnapshot {
  const sourceCount = ADMIN_DEFAULT_COLLECTIONS.reduce((total, collection) => total + source[collection].length, 0)
  if (sourceCount === 0) throw new Error('Admin workspace is empty; refusing to build an empty default snapshot')

  const idMaps: Record<AdminDefaultCollection, IdMap> = {
    categories: buildIdMap('categories', source.categories, adminUid),
    card_types: buildIdMap('card_types', source.card_types, adminUid),
    topics: buildIdMap('topics', source.topics, adminUid),
    decks: buildIdMap('decks', source.decks, adminUid),
  }

  const categories = source.categories.map((document) => ({
    id: idMaps.categories.get(document.id)!,
    data: withTemplateOwner(parseDocument('categories', document, categorySchema)),
  }))

  const cardTypes = source.card_types.map((document) => ({
    id: idMaps.card_types.get(document.id)!,
    data: withTemplateOwner(parseCardTypeDocument(document)),
  }))

  const topics = source.topics.map((document) => ({
    id: idMaps.topics.get(document.id)!,
    data: withTemplateOwner(parseDocument('topics', document, topicSchema)),
  }))

  const categoryAliases = referenceAliases(idMaps.categories)
  const cardTypeAliases = referenceAliases(idMaps.card_types)
  const decks = source.decks.map((document) => {
    const parsed = parseDocument('decks', document, deckSchema)
    return {
      id: idMaps.decks.get(document.id)!,
      data: withTemplateOwner({
        ...parsed,
        default_card_type_ids: parsed.default_card_type_ids.map((id) =>
          resolveReference(id, cardTypeAliases, 'card_types', document.id),
        ),
        default_category_id: parsed.default_category_id
          ? resolveReference(parsed.default_category_id, categoryAliases, 'categories', document.id)
          : null,
      }),
    }
  })

  const byId = (left: DefaultTemplateDocument, right: DefaultTemplateDocument) => left.id.localeCompare(right.id)
  return {
    categories: categories.sort(byId),
    card_types: cardTypes.sort(byId),
    topics: topics.sort(byId),
    decks: decks.sort(byId),
  }
}

function comparableData(data: Record<string, unknown>): Record<string, unknown> {
  const comparable = { ...data }
  delete comparable.created_at
  delete comparable.updated_at
  return comparable
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, canonicalize(entryValue)]),
  )
}

function sameTemplateData(current: Record<string, unknown>, desired: Record<string, unknown>): boolean {
  return JSON.stringify(canonicalize(comparableData(current))) === JSON.stringify(canonicalize(desired))
}

/** Exact replacement plan: desired にない現行 template は delete、差分がある doc だけ update。 */
export function buildTemplateSyncPlan(
  desired: DefaultTemplateSnapshot,
  current: DefaultTemplateSnapshot,
): TemplateSyncPlan {
  const creates: TemplateWriteOperation[] = []
  const updates: TemplateWriteOperation[] = []
  const deletes: TemplateDeleteOperation[] = []

  for (const collection of ADMIN_DEFAULT_COLLECTIONS) {
    const currentById = new Map(current[collection].map((document) => [document.id, document]))
    const desiredIds = new Set(desired[collection].map((document) => document.id))

    for (const document of desired[collection]) {
      const existing = currentById.get(document.id)
      if (!existing) {
        creates.push({ collection, ...document })
      } else if (!sameTemplateData(existing.data, document.data)) {
        updates.push({ collection, ...document, createdAt: existing.data.created_at })
      }
    }

    for (const document of current[collection]) {
      if (!desiredIds.has(document.id)) deletes.push({ collection, id: document.id })
    }
  }

  const byPath = (
    left: { collection: AdminDefaultCollection; id: string },
    right: { collection: AdminDefaultCollection; id: string },
  ) => `${left.collection}/${left.id}`.localeCompare(`${right.collection}/${right.id}`)

  return {
    creates: creates.sort(byPath),
    updates: updates.sort(byPath),
    deletes: deletes.sort(byPath),
  }
}

export function templateSyncOperationCount(plan: TemplateSyncPlan): number {
  return plan.creates.length + plan.updates.length + plan.deletes.length
}

/** 既存 template がある collection を desired snapshot が空にする場合だけ destructive warning 対象とする。 */
export function templateCollectionsEmptiedBySync(
  desired: DefaultTemplateSnapshot,
  current: DefaultTemplateSnapshot,
): AdminDefaultCollection[] {
  return ADMIN_DEFAULT_COLLECTIONS.filter(
    (collection) => desired[collection].length === 0 && current[collection].length > 0,
  )
}

export function assertEmptyTemplateCollectionsAllowed(
  emptiedCollections: AdminDefaultCollection[],
  allowEmpty: boolean,
): void {
  if (emptiedCollections.length === 0 || allowEmpty) return
  throw new Error(
    `Refusing to empty template collection(s): ${emptiedCollections.join(', ')}. ` +
    'Review the dry-run and rerun with --apply --allow-empty if intentional.',
  )
}

export function parseSyncAdminDefaultsArgs(args: string[]): SyncAdminDefaultsArgs {
  const allowed = new Set(['--apply', '--allow-empty', '--help', '-h'])
  const unknown = args.filter((arg) => !allowed.has(arg))
  if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`)
  return {
    apply: args.includes('--apply'),
    allowEmpty: args.includes('--allow-empty'),
    help: args.includes('--help') || args.includes('-h'),
  }
}

/** owner ごとの 4 collections を並列取得。Firestore query を loop 内で逐次実行しない。 */
export async function fetchOwnedWorkspaceSnapshot(
  db: Firestore,
  ownerId: string,
): Promise<AdminWorkspaceSnapshot> {
  const snapshots = await Promise.all(
    ADMIN_DEFAULT_COLLECTIONS.map((collection) =>
      db.collection(collection).where('user_id', '==', ownerId).get(),
    ),
  )

  return Object.fromEntries(
    ADMIN_DEFAULT_COLLECTIONS.map((collection, index) => [
      collection,
      snapshots[index].docs.map((document) => ({
        id: document.id,
        data: { ...document.data() } as Record<string, unknown>,
      })),
    ]),
  ) as AdminWorkspaceSnapshot
}

const FIRESTORE_BATCH_LIMIT = 500
const FIRESTORE_IN_QUERY_LIMIT = 30

function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let offset = 0; offset < items.length; offset += size) chunks.push(items.slice(offset, offset + size))
  return chunks
}

async function commitWriteOperations(
  db: Firestore,
  operations: TemplateWriteOperation[],
  now: Date,
): Promise<void> {
  const batches = []
  for (let offset = 0; offset < operations.length; offset += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch()
    for (const operation of operations.slice(offset, offset + FIRESTORE_BATCH_LIMIT)) {
      batch.set(db.collection(operation.collection).doc(operation.id), {
        ...operation.data,
        created_at: operation.createdAt ?? now,
        updated_at: now,
      })
    }
    batches.push(batch)
  }
  await Promise.all(batches.map((batch) => batch.commit()))
}

async function commitDeleteOperations(db: Firestore, operations: TemplateDeleteOperation[]): Promise<void> {
  const batches = []
  for (let offset = 0; offset < operations.length; offset += FIRESTORE_BATCH_LIMIT) {
    const batch = db.batch()
    for (const operation of operations.slice(offset, offset + FIRESTORE_BATCH_LIMIT)) {
      batch.delete(db.collection(operation.collection).doc(operation.id))
    }
    batches.push(batch)
  }
  await Promise.all(batches.map((batch) => batch.commit()))
}

/** Upsert を先に完了し、stale template の delete は最後に実行する。 */
export async function executeTemplateSyncPlan(
  db: Firestore,
  plan: TemplateSyncPlan,
  now = new Date(),
): Promise<void> {
  await commitWriteOperations(db, [...plan.creates, ...plan.updates], now)
  await commitDeleteOperations(db, plan.deletes)
}

export function backfillTargetUserIds(allUserIds: string[], adminUid: string): string[] {
  return [...new Set(allUserIds)].filter((uid) => uid !== adminUid).sort((left, right) => left.localeCompare(right))
}

export async function listAllAuthUserIds(auth: Auth): Promise<string[]> {
  const userIds: string[] = []
  let pageToken: string | undefined
  do {
    const page = await auth.listUsers(1000, pageToken)
    userIds.push(...page.users.map((user) => user.uid))
    pageToken = page.pageToken
  } while (pageToken)
  return userIds
}

function emptyWorkspaceSnapshot(): AdminWorkspaceSnapshot {
  return { categories: [], card_types: [], topics: [], decks: [] }
}

function normalizedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function logicalIdentity(collection: AdminDefaultCollection, data: Record<string, unknown>): string | null {
  switch (collection) {
    case 'card_types': {
      const code = normalizedString(data.code)
      const formType = normalizedString(data.form_type)
      const language = normalizedString(data.language)?.toLocaleLowerCase('en-US') ?? '*'
      return code && formType
        ? `form_type:${formType}|language:${language}|code:${code.toLocaleLowerCase('en-US')}`
        : null
    }
    case 'decks': {
      const deckName = normalizedString(data.anki_deck_name)
      return deckName ? `anki_deck_name:${deckName}` : null
    }
    case 'categories':
    case 'topics': {
      const formType = normalizedString(data.form_type)
      const name = normalizedString(data.name)
      return formType && name ? `${formType}:${name.toLocaleLowerCase('en-US')}` : null
    }
  }
}

interface ExistingDocumentLookup {
  byId: Map<string, AdminWorkspaceDocument>
  byIdentity: Map<string, AdminWorkspaceDocument>
}

type ExistingWorkspaceIndex = Record<AdminDefaultCollection, Map<string, ExistingDocumentLookup>>

function emptyExistingWorkspaceIndex(): ExistingWorkspaceIndex {
  return {
    categories: new Map(),
    card_types: new Map(),
    topics: new Map(),
    decks: new Map(),
  }
}

function buildExistingWorkspaceIndex(existing: AdminWorkspaceSnapshot): ExistingWorkspaceIndex {
  const index = emptyExistingWorkspaceIndex()

  for (const collection of ADMIN_DEFAULT_COLLECTIONS) {
    const documents = [...existing[collection]].sort((left, right) => left.id.localeCompare(right.id))
    for (const document of documents) {
      const userId = normalizedString(document.data.user_id)
      if (!userId) continue

      let lookup = index[collection].get(userId)
      if (!lookup) {
        lookup = { byId: new Map(), byIdentity: new Map() }
        index[collection].set(userId, lookup)
      }
      lookup.byId.set(document.id, document)

      const identity = logicalIdentity(collection, document.data)
      if (identity && !lookup.byIdentity.has(identity)) lookup.byIdentity.set(identity, document)
    }
  }

  return index
}

function findExistingUserDocument(
  collection: AdminDefaultCollection,
  lookup: ExistingDocumentLookup | undefined,
  desiredId: string,
  desiredData: Record<string, unknown>,
): AdminWorkspaceDocument | undefined {
  const exact = lookup?.byId.get(desiredId)
  if (exact) return exact

  const desiredIdentity = logicalIdentity(collection, desiredData)
  if (!desiredIdentity) return undefined
  return lookup?.byIdentity.get(desiredIdentity)
}

function createUserOperation(
  collection: AdminDefaultCollection,
  template: DefaultTemplateDocument,
  userId: string,
  references: UserDefaultReferenceIds = {},
): UserBackfillOperation {
  const materialized = materializeUserDefaultDocument(collection, template, userId, references)
  return {
    collection,
    userId,
    ...materialized,
  }
}

/** Existing logical identity も考慮し、duplicate を避ける create-only plan を pure に構築。 */
export function buildUserBackfillPlanFromExisting(
  templates: DefaultTemplateSnapshot,
  userIds: string[],
  existing: AdminWorkspaceSnapshot,
): UserBackfillPlan {
  const creates: UserBackfillOperation[] = []
  const existingIndex = buildExistingWorkspaceIndex(existing)

  for (const userId of userIds) {
    const resolvedCategoryIds = new Map<string, string>()
    const resolvedCardTypeIds = new Map<string, string>()

    for (const collection of ['categories', 'card_types', 'topics'] as const) {
      const currentDocuments = existingIndex[collection].get(userId)
      for (const template of templates[collection]) {
        const desiredId = userScopedId(template.id, userId)
        const matched = findExistingUserDocument(collection, currentDocuments, desiredId, template.data)
        const resolvedId = matched?.id ?? desiredId
        if (collection === 'categories') resolvedCategoryIds.set(template.id, resolvedId)
        if (collection === 'card_types') resolvedCardTypeIds.set(template.id, resolvedId)
        if (!matched) creates.push(createUserOperation(collection, template, userId))
      }
    }

    const currentDecks = existingIndex.decks.get(userId)
    for (const template of templates.decks) {
      const desiredId = userScopedId(template.id, userId)
      const matched = findExistingUserDocument('decks', currentDecks, desiredId, template.data)
      if (matched) continue

      creates.push(createUserOperation('decks', template, userId, {
        cardTypeIds: resolvedCardTypeIds,
        categoryIds: resolvedCategoryIds,
      }))
    }
  }

  return {
    targetUserCount: userIds.length,
    creates: creates.sort((left, right) =>
      `${left.userId}/${left.collection}/${left.id}`.localeCompare(`${right.userId}/${right.collection}/${right.id}`),
    ),
  }
}

/** user_id IN query を collection/user chunk ごとに並列実行し、N+1 query を避ける。 */
export async function fetchTargetUsersWorkspaceSnapshot(
  db: Firestore,
  targetUserIds: string[],
): Promise<AdminWorkspaceSnapshot> {
  const userIdChunks = chunkItems([...new Set(targetUserIds)], FIRESTORE_IN_QUERY_LIMIT)
  if (userIdChunks.length === 0) return emptyWorkspaceSnapshot()

  const requests = ADMIN_DEFAULT_COLLECTIONS.flatMap((collection) =>
    userIdChunks.map((userIds) => ({ collection, userIds })),
  )
  const snapshots = await Promise.all(
    requests.map(({ collection, userIds }) =>
      db.collection(collection).where('user_id', 'in', userIds).get(),
    ),
  )
  const result = emptyWorkspaceSnapshot()
  requests.forEach(({ collection }, index) => {
    result[collection].push(...snapshots[index].docs.map((document) => ({
      id: document.id,
      data: { ...document.data() } as Record<string, unknown>,
    })))
  })
  return result
}

/** Existing ID + logical identity をまとめて取得し、create-only backfill plan を作る。 */
export async function buildUserBackfillPlan(
  db: Firestore,
  templates: DefaultTemplateSnapshot,
  targetUserIds: string[],
): Promise<UserBackfillPlan> {
  const existing = await fetchTargetUsersWorkspaceSnapshot(db, targetUserIds)
  return buildUserBackfillPlanFromExisting(templates, targetUserIds, existing)
}

/** create() のみを使い、競合した 1 doc が他 user の write を巻き戻さないよう独立実行する。 */
export async function executeUserBackfillPlan(
  db: Firestore,
  plan: UserBackfillPlan,
  now = new Date(),
): Promise<UserBackfillExecutionResult> {
  const writer = db.bulkWriter()
  let skippedExisting = 0
  writer.onWriteError((error) => {
    if (error.code === GrpcStatus.ALREADY_EXISTS) return false
    const isRetryable = error.code === GrpcStatus.ABORTED || error.code === GrpcStatus.UNAVAILABLE
    return isRetryable && error.failedAttempts < 10
  })

  try {
    await Promise.all(
      plan.creates.map((operation) =>
        writer.create(db.collection(operation.collection).doc(operation.id), {
          ...operation.data,
          created_at: now,
          updated_at: now,
        }).catch((error: unknown) => {
          const code = error && typeof error === 'object' && 'code' in error
            ? (error as { code: unknown }).code
            : undefined
          if (code === GrpcStatus.ALREADY_EXISTS || code === 'already-exists') {
            skippedExisting += 1
            return
          }
          throw error
        }),
      ),
    )
  } finally {
    await writer.close()
  }

  return {
    created: plan.creates.length - skippedExisting,
    skippedExisting,
  }
}
