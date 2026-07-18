/**
 * Stub in-memory cho 'firebase/firestore' — CHỈ active trong vitest qua
 * resolve.alias trong vitest.config.ts. Trên browser, module thật được dùng
 * và runner trả SKIP cho fixture có mocks.firestore.
 *
 * Chỉ implement phần API mà components của AnkiFlow dùng:
 * collection / query / where (equality) / orderBy / getDocs / doc /
 * addDoc / updateDoc / deleteDoc / serverTimestamp / arrayRemove.
 */
import type { DocSeed } from '@/verify/core/types'

interface CollectionRef {
  __kind: 'collection'
  name: string
}

interface DocRef {
  __kind: 'doc'
  collection: string
  id: string
}

interface WhereConstraint {
  __kind: 'where'
  field: string
  op: string
  value: unknown
}

interface OrderByConstraint {
  __kind: 'orderBy'
  field: string
  direction: 'asc' | 'desc'
}

type QueryConstraint = WhereConstraint | OrderByConstraint

interface QueryRef {
  __kind: 'query'
  collection: string
  constraints: QueryConstraint[]
}

const SERVER_TIMESTAMP = { __kind: 'serverTimestamp' } as const

interface ArrayRemoveSentinel {
  __kind: 'arrayRemove'
  values: unknown[]
}

let store = new Map<string, DocSeed[]>()
let autoId = 0

function maybeThrow(operation: 'addDoc' | 'updateDoc', collectionName: string): void {
  const failure = (store.get('__verify_failures__') ?? []).find(doc => (
    doc.operation === operation && doc.collection === collectionName
  ))
  if (failure) {
    throw new Error(typeof failure.message === 'string' ? failure.message : 'Simulated Firestore failure')
  }
}

function seed(data: Record<string, DocSeed[]>): void {
  // Auto-inject user_id='test-user' (khớp TEST_AUTH_USER trong runner) khi seed
  // không khai báo — components multi-user filter where('user_id'...) vẫn thấy docs.
  // Seed muốn giả doc của user khác chỉ cần set user_id tường minh.
  store = new Map(
    Object.entries(data).map(([name, docs]) => [
      name,
      docs.map(d => ({ user_id: 'test-user', ...d })),
    ]),
  )
  autoId = 0
}

function reset(): void {
  store = new Map()
  autoId = 0
}

// Runner seed/reset store qua global hooks (không import được module alias này trực tiếp)
const g = globalThis as unknown as {
  __verifyFirestoreSeed?: typeof seed
  __verifyFirestoreReset?: typeof reset
  __verifyFirestoreStore?: () => Map<string, DocSeed[]>
}
g.__verifyFirestoreSeed = seed
g.__verifyFirestoreReset = reset
g.__verifyFirestoreStore = () => store

export function getFirestore(): Record<string, never> {
  return {}
}

export function collection(_db: unknown, name: string): CollectionRef {
  return { __kind: 'collection', name }
}

export function doc(_db: unknown, name: string, id: string): DocRef {
  return { __kind: 'doc', collection: name, id }
}

export function where(field: string, op: string, value: unknown): WhereConstraint {
  return { __kind: 'where', field, op, value }
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): OrderByConstraint {
  return { __kind: 'orderBy', field, direction }
}

export function query(
  source: CollectionRef | QueryRef,
  ...constraints: QueryConstraint[]
): QueryRef {
  const base = source.__kind === 'query' ? source : { collection: source.name, constraints: [] }
  return {
    __kind: 'query',
    collection: source.__kind === 'query' ? source.collection : source.name,
    constraints: [...(base.constraints ?? []), ...constraints],
  }
}

function applyConstraints(docs: DocSeed[], constraints: QueryConstraint[]): DocSeed[] {
  let result = [...docs]
  for (const c of constraints) {
    if (c.__kind === 'where') {
      // Chỉ hỗ trợ equality và 'in' — đủ cho components hiện tại
      if (c.op === '==') {
        result = result.filter(d => d[c.field] === c.value)
      } else if (c.op === 'in' && Array.isArray(c.value)) {
        result = result.filter(d => (c.value as unknown[]).includes(d[c.field]))
      } else {
        throw new Error(`firestore-stub: chưa hỗ trợ where op "${c.op}"`)
      }
    } else if (c.__kind === 'orderBy') {
      result.sort((a, b) => {
        const av = a[c.field] as string | number
        const bv = b[c.field] as string | number
        const cmp = av < bv ? -1 : av > bv ? 1 : 0
        return c.direction === 'desc' ? -cmp : cmp
      })
    }
  }
  return result
}

interface SnapshotDoc {
  id: string
  data: () => Record<string, unknown>
  exists: () => boolean
}

function toSnapshotDoc(d: DocSeed): SnapshotDoc {
  const { id, ...data } = d
  return { id, data: () => data, exists: () => true }
}

export async function getDocs(source: CollectionRef | QueryRef): Promise<{
  docs: SnapshotDoc[]
  empty: boolean
  size: number
}> {
  const name = source.__kind === 'query' ? source.collection : source.name
  const constraints = source.__kind === 'query' ? source.constraints : []
  const docs = applyConstraints(store.get(name) ?? [], constraints).map(toSnapshotDoc)
  return { docs, empty: docs.length === 0, size: docs.length }
}

export async function getDoc(ref: DocRef): Promise<SnapshotDoc | { exists: () => false; id: string; data: () => undefined }> {
  const found = (store.get(ref.collection) ?? []).find(d => d.id === ref.id)
  if (!found) return { exists: () => false, id: ref.id, data: () => undefined }
  return toSnapshotDoc(found)
}

export async function addDoc(ref: CollectionRef, data: Record<string, unknown>): Promise<DocRef> {
  maybeThrow('addDoc', ref.name)
  const id = `stub-${++autoId}`
  const docs = store.get(ref.name) ?? []
  docs.push({ id, ...data })
  store.set(ref.name, docs)
  return { __kind: 'doc', collection: ref.name, id }
}

export async function updateDoc(ref: DocRef, data: Record<string, unknown>): Promise<void> {
  maybeThrow('updateDoc', ref.collection)
  const docs = store.get(ref.collection) ?? []
  const target = docs.find(d => d.id === ref.id)
  if (!target) throw new Error(`firestore-stub: không tìm thấy doc ${ref.collection}/${ref.id}`)
  Object.entries(data).forEach(([key, value]) => {
    if (
      typeof value === 'object'
      && value !== null
      && '__kind' in value
      && value.__kind === 'arrayRemove'
    ) {
      const sentinel = value as ArrayRemoveSentinel
      const current = Array.isArray(target[key]) ? target[key] : []
      target[key] = current.filter(item => !sentinel.values.includes(item))
      return
    }
    target[key] = value
  })
}

export async function deleteDoc(ref: DocRef): Promise<void> {
  const docs = store.get(ref.collection) ?? []
  store.set(ref.collection, docs.filter(d => d.id !== ref.id))
}

export function serverTimestamp(): typeof SERVER_TIMESTAMP {
  return SERVER_TIMESTAMP
}

export function arrayRemove(...values: unknown[]): ArrayRemoveSentinel {
  return { __kind: 'arrayRemove', values }
}

export function onSnapshot(
  source: CollectionRef | QueryRef,
  onNext: (snapshot: { docs: SnapshotDoc[]; empty: boolean; size: number }) => void,
  onError?: (error: Error) => void,
): () => void {
  const name = source.__kind === 'query' ? source.collection : source.name
  const constraints = source.__kind === 'query' ? source.constraints : []
  try {
    const docs = applyConstraints(store.get(name) ?? [], constraints).map(toSnapshotDoc)
    onNext({ docs, empty: docs.length === 0, size: docs.length })
  } catch (err) {
    onError?.(err as Error)
  }
  return () => {}
}

export function limit(n: number): OrderByConstraint {
  // no-op constraint — đủ cho mục đích verify
  void n
  return { __kind: 'orderBy', field: '__noop', direction: 'asc' }
}

export class Timestamp {
  constructor(public seconds: number, public nanoseconds: number) {}
  static now(): Timestamp {
    return new Timestamp(Math.floor(Date.now() / 1000), 0)
  }
  toDate(): Date {
    return new Date(this.seconds * 1000)
  }
}
