import type { Firestore } from 'firebase-admin/firestore'
import { resolveBuiltinAiOutputProfiles } from '@/lib/ai-agent/builtinOutputProfiles'
import { cloneAiOutputProfiles } from '@/lib/ai-agent/outputProfiles'
import { resolveContentTypeFormType } from '@/lib/contentTypes'
import {
  GLOBAL_CONTENT_TYPES_COLLECTION,
  USER_CONTENT_TYPES_COLLECTION,
} from '@/lib/constants'
import { FormType } from '@/types'
import type { AiOutputProfile } from '@/types'

const TRANSACTION_CONCURRENCY = 20
const MIGRATABLE_BUILTIN_CODES = [
  'language',
  FormType.LANGUAGE,
  'it',
  FormType.IT,
] as const

export type AiOutputProfileMigrationScope = 'global' | 'user'

export interface AiOutputProfileMigrationArgs {
  apply: boolean
  help: boolean
}

export interface AiOutputProfileMigrationDocument {
  id: string
  scope: AiOutputProfileMigrationScope
  data: Record<string, unknown>
}

export interface AiOutputProfileMigrationCandidate {
  id: string
  path: string
  scope: AiOutputProfileMigrationScope
  formType: FormType
  profiles: AiOutputProfile[]
}

export interface AiOutputProfileMigrationPlan {
  scannedGlobal: number
  scannedUser: number
  candidates: AiOutputProfileMigrationCandidate[]
  skippedConfigured: number
  skippedUnsupported: number
}

export interface AiOutputProfileMigrationFailure {
  path: string
  message: string
}

export interface AiOutputProfileMigrationResult {
  updated: number
  skippedConfigured: number
  failed: AiOutputProfileMigrationFailure[]
}

export function parseAiOutputProfileMigrationArgs(args: string[]): AiOutputProfileMigrationArgs {
  const allowed = new Set(['--apply', '--help', '-h'])
  const unknown = args.filter(arg => !allowed.has(arg))
  if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`)
  return {
    apply: args.includes('--apply'),
    help: args.includes('--help') || args.includes('-h'),
  }
}

function hasStoredProfiles(data: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(data, 'ai_output_profiles')
}

function collectionForScope(scope: AiOutputProfileMigrationScope): string {
  return scope === 'global'
    ? GLOBAL_CONTENT_TYPES_COLLECTION
    : USER_CONTENT_TYPES_COLLECTION
}

/** Built-in Language/IT documents だけを対象に、入力を変更せず deterministic plan を作る。 */
export function buildAiOutputProfileMigrationPlan(
  documents: readonly AiOutputProfileMigrationDocument[],
): AiOutputProfileMigrationPlan {
  const candidates: AiOutputProfileMigrationCandidate[] = []
  let skippedConfigured = 0
  let skippedUnsupported = 0

  const sorted = [...documents].sort((left, right) => (
    left.scope.localeCompare(right.scope) || left.id.localeCompare(right.id)
  ))

  for (const document of sorted) {
    if (hasStoredProfiles(document.data)) {
      skippedConfigured += 1
      continue
    }
    const code = typeof document.data.code === 'string' ? document.data.code : ''
    const formType = resolveContentTypeFormType(code)
    const profiles = formType ? resolveBuiltinAiOutputProfiles(formType) : null
    if (!formType || !profiles) {
      skippedUnsupported += 1
      continue
    }
    candidates.push({
      id: document.id,
      path: `${collectionForScope(document.scope)}/${document.id}`,
      scope: document.scope,
      formType,
      profiles,
    })
  }

  return {
    scannedGlobal: documents.filter(document => document.scope === 'global').length,
    scannedUser: documents.filter(document => document.scope === 'user').length,
    candidates,
    skippedConfigured,
    skippedUnsupported,
  }
}

/** Built-in code だけを global/user collections から並列取得し、full scan と N+1 query を避ける。 */
export async function fetchAiOutputProfileMigrationDocuments(
  db: Firestore,
): Promise<AiOutputProfileMigrationDocument[]> {
  const [globalSnapshot, userSnapshot] = await Promise.all([
    db.collection(GLOBAL_CONTENT_TYPES_COLLECTION).where('code', 'in', [...MIGRATABLE_BUILTIN_CODES]).get(),
    db.collection(USER_CONTENT_TYPES_COLLECTION).where('code', 'in', [...MIGRATABLE_BUILTIN_CODES]).get(),
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

/**
 * Apply 用 executor。各 transaction で field absence を再確認し、dry-run 後に追加された
 * customization を上書きしない。呼び出し側は明示承認後だけ実行する。
 */
export async function executeAiOutputProfileMigration(
  db: Firestore,
  plan: AiOutputProfileMigrationPlan,
  now = new Date(),
): Promise<AiOutputProfileMigrationResult> {
  let updated = 0
  let skippedConfigured = 0
  const failed: AiOutputProfileMigrationFailure[] = []

  for (const chunk of chunksOf(plan.candidates, TRANSACTION_CONCURRENCY)) {
    await Promise.all(chunk.map(async candidate => {
      try {
        const collection = collectionForScope(candidate.scope)
        const ref = db.collection(collection).doc(candidate.id)
        const outcome = await db.runTransaction(async transaction => {
          const snapshot = await transaction.get(ref)
          if (!snapshot.exists) throw new Error('Document no longer exists')
          const current = snapshot.data() as Record<string, unknown>
          if (hasStoredProfiles(current)) return 'skipped' as const
          transaction.update(ref, {
            ai_output_profiles: cloneAiOutputProfiles(candidate.profiles),
            updated_at: now,
          })
          return 'updated' as const
        })
        if (outcome === 'updated') updated += 1
        else skippedConfigured += 1
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
    failed: failed.sort((left, right) => left.path.localeCompare(right.path)),
  }
}
