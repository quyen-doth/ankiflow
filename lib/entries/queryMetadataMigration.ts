import type {
  DocumentData,
  DocumentSnapshot,
  Firestore,
  Timestamp,
  UpdateData,
} from 'firebase-admin/firestore'
import {
  deriveEntryQueryMetadata,
  entryQueryMetadataMatches,
  ENTRY_QUERY_GLOBAL_READY_AT_FIELD,
  ENTRY_QUERY_GLOBAL_VERSION_FIELD,
  ENTRY_QUERY_MANAGED_FIELDS,
  ENTRY_QUERY_SCHEMA_VERSION,
  ENTRY_QUERY_SCHEMA_VERSION_FIELD,
  findReservedEntryQueryFields,
  isReservedEntryQueryField,
  type EntryQueryMetadata,
} from '@/lib/entries/queryMetadata'
import {
  GLOBAL_CONTENT_TYPES_COLLECTION,
  GLOBAL_SETTINGS_DOC_ID,
  USER_CONTENT_TYPES_COLLECTION,
} from '@/lib/constants'

const APPLY_CONCURRENCY = 20

export interface EntryQueryMigrationArgs {
  apply: boolean
  help: boolean
}

export interface EntryQueryMigrationEntry {
  id: string
  path: string
  data: Record<string, unknown>
  updateTime?: Timestamp
}

export interface EntryQueryMigrationContentType {
  path: string
  fieldKeys: string[]
}

export interface EntryQueryMigrationInput {
  entries: EntryQueryMigrationEntry[]
  contentTypes: EntryQueryMigrationContentType[]
}

export interface EntryQueryMigrationCandidate {
  id: string
  path: string
  metadata: EntryQueryMetadata
  updateTime?: Timestamp
}

export interface EntryQueryMigrationCollision {
  path: string
  fields: string[]
  reason: string
}

export interface EntryQueryMigrationPlan {
  scannedEntries: number
  scannedContentTypes: number
  unchangedEntries: number
  candidates: EntryQueryMigrationCandidate[]
  collisions: EntryQueryMigrationCollision[]
}

export interface EntryQueryMigrationFailure {
  path: string
  message: string
}

export interface EntryQueryMigrationResult {
  updated: number
  failures: EntryQueryMigrationFailure[]
}

export function parseEntryQueryMigrationArgs(args: string[]): EntryQueryMigrationArgs {
  const allowed = new Set(['--apply', '--help', '-h'])
  const unknown = args.filter(arg => !allowed.has(arg))
  if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`)
  return {
    apply: args.includes('--apply'),
    help: args.includes('--help') || args.includes('-h'),
  }
}

function compactEntrySnapshot(snapshot: DocumentSnapshot): EntryQueryMigrationEntry {
  const data = snapshot.data() as Record<string, unknown>
  const reservedData = Object.fromEntries(
    Object.entries(data).filter(([key]) => isReservedEntryQueryField(key)),
  )
  return {
    id: snapshot.id,
    path: snapshot.ref.path,
    data: {
      word: data.word,
      term: data.term,
      title: data.title,
      card_type_ids: data.card_type_ids,
      ...reservedData,
    },
    updateTime: snapshot.updateTime,
  }
}

function contentTypeFields(snapshot: DocumentSnapshot): EntryQueryMigrationContentType {
  const data = snapshot.data() as Record<string, unknown>
  const fields = Array.isArray(data.fields) ? data.fields : []
  return {
    path: snapshot.ref.path,
    fieldKeys: fields.flatMap(field => {
      if (!field || typeof field !== 'object') return []
      const key = (field as Record<string, unknown>).field_key
      return typeof key === 'string' ? [key] : []
    }),
  }
}

/**
 * Entry は未知の `_query_*` collision も検出する必要があるため full document を stream する。
 * ただし plan には primary/card IDs と reserved fields だけを保持し、media payload を蓄積しない。
 */
export async function fetchEntryQueryMigrationInput(
  db: Firestore,
): Promise<EntryQueryMigrationInput> {
  const entries: EntryQueryMigrationEntry[] = []
  const stream = db.collection('entries').stream() as unknown as AsyncIterable<DocumentSnapshot>
  for await (const snapshot of stream) {
    entries.push(compactEntrySnapshot(snapshot))
  }

  const [globalSnapshot, userSnapshot] = await Promise.all([
    db.collection(GLOBAL_CONTENT_TYPES_COLLECTION).select('fields').get(),
    db.collection(USER_CONTENT_TYPES_COLLECTION).select('fields').get(),
  ])

  return {
    entries,
    contentTypes: [
      ...globalSnapshot.docs.map(contentTypeFields),
      ...userSnapshot.docs.map(contentTypeFields),
    ],
  }
}

export function buildEntryQueryMigrationPlan(
  input: EntryQueryMigrationInput,
): EntryQueryMigrationPlan {
  const candidates: EntryQueryMigrationCandidate[] = []
  const collisions: EntryQueryMigrationCollision[] = []
  let unchangedEntries = 0

  for (const contentType of [...input.contentTypes].sort((left, right) => (
    left.path.localeCompare(right.path)
  ))) {
    const fields = contentType.fieldKeys.filter(isReservedEntryQueryField).sort()
    if (fields.length > 0) {
      collisions.push({
        path: contentType.path,
        fields,
        reason: 'Content Type uses the reserved Entry query prefix',
      })
    }
  }

  for (const entry of [...input.entries].sort((left, right) => (
    left.path.localeCompare(right.path)
  ))) {
    const reservedFields = findReservedEntryQueryFields(entry.data)
    if (reservedFields.length > 0
      && entry.data[ENTRY_QUERY_SCHEMA_VERSION_FIELD] !== ENTRY_QUERY_SCHEMA_VERSION) {
      collisions.push({
        path: entry.path,
        fields: reservedFields,
        reason: 'Entry contains unmanaged reserved-prefix data',
      })
      continue
    }

    const unknownManagedFields = reservedFields.filter(field => (
      !ENTRY_QUERY_MANAGED_FIELDS.includes(field as typeof ENTRY_QUERY_MANAGED_FIELDS[number])
    ))
    if (unknownManagedFields.length > 0) {
      collisions.push({
        path: entry.path,
        fields: unknownManagedFields,
        reason: 'Entry contains unknown reserved-prefix data',
      })
      continue
    }

    if (reservedFields.length > 0 && entryQueryMetadataMatches(entry.data)) {
      unchangedEntries += 1
      continue
    }

    candidates.push({
      id: entry.id,
      path: entry.path,
      metadata: deriveEntryQueryMetadata(entry.data),
      updateTime: entry.updateTime,
    })
  }

  return {
    scannedEntries: input.entries.length,
    scannedContentTypes: input.contentTypes.length,
    unchangedEntries,
    candidates,
    collisions: collisions.sort((left, right) => left.path.localeCompare(right.path)),
  }
}

function chunksOf<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let offset = 0; offset < items.length; offset += size) {
    chunks.push(items.slice(offset, offset + size))
  }
  return chunks
}

export async function executeEntryQueryMigration(
  db: Firestore,
  plan: EntryQueryMigrationPlan,
): Promise<EntryQueryMigrationResult> {
  if (plan.collisions.length > 0) {
    throw new Error('Refusing to apply while Entry query metadata collisions remain')
  }

  let updated = 0
  const failures: EntryQueryMigrationFailure[] = []
  for (const chunk of chunksOf(plan.candidates, APPLY_CONCURRENCY)) {
    await Promise.all(chunk.map(async candidate => {
      try {
        if (!candidate.updateTime) throw new Error('Missing document updateTime precondition')
        await db.collection('entries').doc(candidate.id).update(
          candidate.metadata as unknown as UpdateData<DocumentData>,
          { lastUpdateTime: candidate.updateTime },
        )
        updated += 1
      } catch (error) {
        failures.push({
          path: candidate.path,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }))
  }

  return {
    updated,
    failures: failures.sort((left, right) => left.path.localeCompare(right.path)),
  }
}

export async function markEntryQuerySchemaReady(
  db: Firestore,
  now = new Date(),
): Promise<void> {
  await db.collection('settings').doc(GLOBAL_SETTINGS_DOC_ID).set({
    [ENTRY_QUERY_GLOBAL_VERSION_FIELD]: ENTRY_QUERY_SCHEMA_VERSION,
    [ENTRY_QUERY_GLOBAL_READY_AT_FIELD]: now,
    updated_at: now,
  }, { merge: true })
}
