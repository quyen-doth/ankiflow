import type {
  Firestore,
  QueryDocumentSnapshot,
  QuerySnapshot,
} from 'firebase-admin/firestore'
import { GLOBAL_SETTINGS_DOC_ID } from '@/lib/constants'
import {
  DUPLICATE_LOOKUP_BATCH_LIMIT,
  entryPrimaryValue,
  normalizeTerm,
  normalizedEntryPrimaryValue,
} from '@/lib/entries/duplicate'
import {
  ENTRY_QUERY_DUPLICATE_KEY_FIELD,
  ENTRY_QUERY_GLOBAL_VERSION_FIELD,
  ENTRY_QUERY_SCHEMA_VERSION,
} from '@/lib/entries/queryMetadata'

/** Firestore Standard edition の `in` は最大 30 equality clauses。 */
export const DUPLICATE_LOOKUP_IN_LIMIT = 30

const FALLBACK_PROJECTION = [
  'word',
  'term',
  'title',
  'anki_deck',
  'status',
  'created_at',
] as const

const READY_PROJECTION = [
  ENTRY_QUERY_DUPLICATE_KEY_FIELD,
  ...FALLBACK_PROJECTION,
] as const

export interface DuplicateEntry {
  id: string
  word: string
  anki_deck: string
  status: string
  created_at: string | null
}

export interface DuplicateLookupResult {
  word: string
  duplicates: DuplicateEntry[]
}

interface PreparedTargets {
  requested: string[]
  normalized: string[]
}

function prepareTargets(targets: readonly string[]): PreparedTargets {
  if (targets.length > DUPLICATE_LOOKUP_BATCH_LIMIT) {
    throw new Error(`Duplicate lookup accepts at most ${DUPLICATE_LOOKUP_BATCH_LIMIT} targets`)
  }

  const requested = targets.map(target => target.trim()).filter(Boolean)
  const normalized = [...new Set(requested.map(normalizeTerm))]
  return { requested, normalized }
}

function chunksOf<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let offset = 0; offset < items.length; offset += size) {
    chunks.push(items.slice(offset, offset + size))
  }
  return chunks
}

function serializeCreatedAt(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const toDate = (value as { toDate?: () => unknown }).toDate
  if (typeof toDate !== 'function') return null
  const date = toDate.call(value)
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null
}

function toDuplicateEntry(snapshot: QueryDocumentSnapshot): DuplicateEntry {
  const data = snapshot.data() as Record<string, unknown>
  return {
    id: snapshot.id,
    word: entryPrimaryValue(data),
    anki_deck: typeof data.anki_deck === 'string' ? data.anki_deck : '',
    status: typeof data.status === 'string' ? data.status : '',
    created_at: serializeCreatedAt(data.created_at),
  }
}

function appendSnapshot(
  matches: Map<string, DuplicateEntry[]>,
  snapshot: QueryDocumentSnapshot,
  ready: boolean,
): void {
  const data = snapshot.data() as Record<string, unknown>
  const key = ready && typeof data[ENTRY_QUERY_DUPLICATE_KEY_FIELD] === 'string'
    ? data[ENTRY_QUERY_DUPLICATE_KEY_FIELD]
    : normalizedEntryPrimaryValue(data)
  if (!key) return
  const current = matches.get(key) ?? []
  current.push(toDuplicateEntry(snapshot))
  matches.set(key, current)
}

async function isQuerySchemaReady(db: Firestore): Promise<boolean> {
  const snapshot = await db.collection('settings').doc(GLOBAL_SETTINGS_DOC_ID).get()
  return snapshot.data()?.[ENTRY_QUERY_GLOBAL_VERSION_FIELD] === ENTRY_QUERY_SCHEMA_VERSION
}

async function fetchReadySnapshots(
  db: Firestore,
  uid: string,
  normalizedTargets: readonly string[],
): Promise<QuerySnapshot[]> {
  return Promise.all(
    chunksOf(normalizedTargets, DUPLICATE_LOOKUP_IN_LIMIT).map(chunk => (
      db.collection('entries')
        .where('user_id', '==', uid)
        .where(ENTRY_QUERY_DUPLICATE_KEY_FIELD, 'in', chunk)
        .select(...READY_PROJECTION)
        .get()
    )),
  )
}

async function fetchFallbackSnapshot(
  db: Firestore,
  uid: string,
): Promise<QuerySnapshot> {
  return db.collection('entries')
    .where('user_id', '==', uid)
    .select(...FALLBACK_PROJECTION)
    .get()
}

/**
 * Global duplicate lookup。ready marker 前は legacy Entry を落とさない projected scan、
 * marker 後は `_query_duplicate_key` の indexed `in` query を使う。
 */
export async function lookupEntryDuplicates(
  db: Firestore,
  uid: string,
  targets: readonly string[],
): Promise<DuplicateLookupResult[]> {
  const prepared = prepareTargets(targets)
  if (prepared.requested.length === 0) return []

  const ready = await isQuerySchemaReady(db)
  const snapshots = ready
    ? await fetchReadySnapshots(db, uid, prepared.normalized)
    : [await fetchFallbackSnapshot(db, uid)]

  const matches = new Map<string, DuplicateEntry[]>()
  for (const snapshot of snapshots) {
    for (const document of snapshot.docs) {
      appendSnapshot(matches, document, ready)
    }
  }

  return prepared.requested.map(word => ({
    word,
    duplicates: matches.get(normalizeTerm(word)) ?? [],
  }))
}
