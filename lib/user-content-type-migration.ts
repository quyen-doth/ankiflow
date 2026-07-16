import { GrpcStatus, type Firestore } from 'firebase-admin/firestore'
import type { Auth } from 'firebase-admin/auth'
import {
  materializeUserContentType,
  parseContentTypeConfig,
  type ContentTypeSourceDocument,
  type MaterializedUserContentType,
} from '@/lib/contentTypes'
import {
  GLOBAL_CONTENT_TYPES_COLLECTION,
  USER_CONTENT_TYPES_COLLECTION,
} from '@/lib/constants'

const FIRESTORE_IN_QUERY_LIMIT = 30

export interface UserContentTypeMigrationArgs {
  apply: boolean
  help: boolean
}

export interface ExistingUserContentTypeDocument {
  id: string
  data: Record<string, unknown>
}

export interface UserContentTypeCreateCandidate {
  id: string
  userId: string
  sourceContentTypeId: string
  data: MaterializedUserContentType['data']
}

export interface UserContentTypeMigrationPlan {
  targetUserCount: number
  globalDefaultCount: number
  creates: UserContentTypeCreateCandidate[]
  skippedById: number
  skippedByCode: number
}

export interface UserContentTypeMigrationFailure {
  path: string
  errorCode: string | number
}

export interface UserContentTypeMigrationResult {
  created: number
  skippedExisting: number
  failed: UserContentTypeMigrationFailure[]
}

export function parseUserContentTypeMigrationArgs(args: string[]): UserContentTypeMigrationArgs {
  const allowed = new Set(['--apply', '--help', '-h'])
  const unknown = args.filter(arg => !allowed.has(arg))
  if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`)
  return {
    apply: args.includes('--apply'),
    help: args.includes('--help') || args.includes('-h'),
  }
}

function normalizedCode(value: unknown): string | null {
  return typeof value === 'string' && value.trim()
    ? value.trim().toLocaleLowerCase('en-US')
    : null
}

/** Existing snapshot から ID/code index を作り、入力 array は変更しない。 */
function indexExistingDocuments(
  documents: ExistingUserContentTypeDocument[],
): Map<string, { ids: Set<string>; codes: Set<string> }> {
  const index = new Map<string, { ids: Set<string>; codes: Set<string> }>()

  for (const document of [...documents].sort((left, right) => left.id.localeCompare(right.id))) {
    const userId = typeof document.data.user_id === 'string' ? document.data.user_id.trim() : ''
    if (!userId) continue

    let workspace = index.get(userId)
    if (!workspace) {
      workspace = { ids: new Set(), codes: new Set() }
      index.set(userId, workspace)
    }
    workspace.ids.add(document.id)
    const code = normalizedCode(document.data.code)
    if (code) workspace.codes.add(code)
  }

  return index
}

/** ID と code の両方を考慮し、create-only migration plan を pure に構築する。 */
export function buildUserContentTypeMigrationPlan(
  sources: ContentTypeSourceDocument[],
  userIds: string[],
  existing: ExistingUserContentTypeDocument[],
): UserContentTypeMigrationPlan {
  const uniqueUserIds = [...new Set(userIds)].sort((left, right) => left.localeCompare(right))
  const sortedSources = [...sources].sort((left, right) => left.id.localeCompare(right.id))
  const existingIndex = indexExistingDocuments(existing)
  const creates: UserContentTypeCreateCandidate[] = []
  let skippedById = 0
  let skippedByCode = 0

  for (const userId of uniqueUserIds) {
    const workspace = existingIndex.get(userId) ?? { ids: new Set<string>(), codes: new Set<string>() }

    for (const source of sortedSources) {
      const materialized = materializeUserContentType(source, userId)
      if (workspace.ids.has(materialized.id)) {
        skippedById += 1
        continue
      }

      const code = normalizedCode(source.code)
      if (code && workspace.codes.has(code)) {
        skippedByCode += 1
        continue
      }

      creates.push({
        id: materialized.id,
        userId,
        sourceContentTypeId: source.id,
        data: materialized.data,
      })
      workspace.ids.add(materialized.id)
      if (code) workspace.codes.add(code)
    }
  }

  return {
    targetUserCount: uniqueUserIds.length,
    globalDefaultCount: sortedSources.length,
    creates,
    skippedById,
    skippedByCode,
  }
}

export async function listAllMigrationUserIds(auth: Auth): Promise<string[]> {
  const userIds: string[] = []
  let pageToken: string | undefined
  do {
    const page = await auth.listUsers(1000, pageToken)
    userIds.push(...page.users.map(user => user.uid))
    pageToken = page.pageToken
  } while (pageToken)
  return userIds
}

export async function fetchGlobalContentTypesForMigration(
  db: Firestore,
): Promise<ContentTypeSourceDocument[]> {
  const snapshot = await db.collection(GLOBAL_CONTENT_TYPES_COLLECTION).get()
  return snapshot.docs.map(document => {
    const data = document.data()
    try {
      return {
        id: document.id,
        ...parseContentTypeConfig(data),
      }
    } catch (error) {
      const fields = Object.keys(data).sort((left, right) => left.localeCompare(right)).join(', ') || '(none)'
      throw new Error(
        `Invalid ${GLOBAL_CONTENT_TYPES_COLLECTION}/${document.id} (fields: ${fields}): ` +
        `${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      )
    }
  })
}

function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let offset = 0; offset < items.length; offset += size) {
    chunks.push(items.slice(offset, offset + size))
  }
  return chunks
}

/** user_id IN query を UID chunk ごとに並列実行し、user 単位の N+1 query を避ける。 */
export async function fetchExistingUserContentTypes(
  db: Firestore,
  userIds: string[],
): Promise<ExistingUserContentTypeDocument[]> {
  const chunks = chunkItems([...new Set(userIds)], FIRESTORE_IN_QUERY_LIMIT)
  if (chunks.length === 0) return []

  const snapshots = await Promise.all(
    chunks.map(ids => db.collection(USER_CONTENT_TYPES_COLLECTION).where('user_id', 'in', ids).get()),
  )
  return snapshots.flatMap(snapshot => snapshot.docs.map(document => ({
    id: document.id,
    data: { ...document.data() } as Record<string, unknown>,
  })))
}

function migrationErrorCode(error: unknown): string | number {
  if (!error || typeof error !== 'object' || !('code' in error)) return 'unknown'
  const code = (error as { code: unknown }).code
  return typeof code === 'string' || typeof code === 'number' ? code : 'unknown'
}

/** BulkWriter create() のみを使い、1 件の競合や失敗で他 user の create を巻き戻さない。 */
export async function executeUserContentTypeMigration(
  db: Firestore,
  plan: UserContentTypeMigrationPlan,
  now = new Date(),
): Promise<UserContentTypeMigrationResult> {
  const writer = db.bulkWriter()
  let created = 0
  let skippedExisting = 0
  const failed: UserContentTypeMigrationFailure[] = []

  writer.onWriteError(error => {
    if (error.code === GrpcStatus.ALREADY_EXISTS) return false
    const retryable = error.code === GrpcStatus.ABORTED || error.code === GrpcStatus.UNAVAILABLE
    return retryable && error.failedAttempts < 10
  })

  try {
    await Promise.all(plan.creates.map(async candidate => {
      const path = `${USER_CONTENT_TYPES_COLLECTION}/${candidate.id}`
      try {
        await writer.create(db.collection(USER_CONTENT_TYPES_COLLECTION).doc(candidate.id), {
          ...candidate.data,
          created_at: now,
          updated_at: now,
        })
        created += 1
      } catch (error) {
        const code = migrationErrorCode(error)
        if (code === GrpcStatus.ALREADY_EXISTS || code === 'already-exists') {
          skippedExisting += 1
          return
        }
        failed.push({ path, errorCode: code })
      }
    }))
  } finally {
    await writer.close()
  }

  return {
    created,
    skippedExisting,
    failed: failed.sort((left, right) => left.path.localeCompare(right.path)),
  }
}
