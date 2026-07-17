/**
 * ユーザー間データコピー用 one-time CLI。
 *
 * Usage:
 *   npx tsx scripts/copy-user-data.ts --from <uidA> --to <uidB> --mode full [--apply]
 *   npx tsx scripts/copy-user-data.ts --from <uidA> --to <uidB> --mode master [--apply]
 *
 * デフォルトは read-only dry-run。--apply はレビュー済み plan の create のみを実行する。
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env', quiet: true })

import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth, type Auth, type UserRecord } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { pathToFileURL } from 'node:url'
import { normalizeStudyLanguages, resolveStudyLanguage } from '../lib/studyLanguages'
import {
  COPY_FULL_ONLY_COLLECTIONS,
  COPY_MASTER_COLLECTIONS,
  buildCopyPlan,
  emptyCopySnapshot,
  parseCopyUserDataArgs,
  type CopyCollection,
  type CopyDocument,
  type CopyMode,
  type CopyOperation,
  type CopyPlan,
  type CopySnapshot,
} from './copy-user-data-core'

const WRITE_BATCH_SIZE = 400

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`必須環境変数がありません: ${name}`)
  return value
}

function printUsage(): void {
  console.log('Usage:')
  console.log('  npx tsx scripts/copy-user-data.ts --from <uidA> --to <uidB> --mode full [--apply]')
  console.log('  npx tsx scripts/copy-user-data.ts --from <uidA> --to <uidB> --mode master [--apply]')
  console.log('')
  console.log('  default  読み取り専用 dry-run')
  console.log('  --apply  dry-run で確認済みの create を Firestore に適用')
}

function collectionsForMode(mode: CopyMode): CopyCollection[] {
  return mode === 'full'
    ? [...COPY_MASTER_COLLECTIONS, ...COPY_FULL_ONLY_COLLECTIONS]
    : [...COPY_MASTER_COLLECTIONS]
}

async function loadAuthUsers(auth: Auth, fromUid: string, toUid: string): Promise<UserRecord[]> {
  return Promise.all([
    auth.getUser(fromUid).catch(error => {
      throw new Error(`コピー元 UID が Firebase Auth に存在しません: ${fromUid}`, { cause: error })
    }),
    auth.getUser(toUid).catch(error => {
      throw new Error(`コピー先 UID が Firebase Auth に存在しません: ${toUid}`, { cause: error })
    }),
  ])
}

function assertMasterTargetIsAdmin(mode: CopyMode, targetUser: UserRecord): void {
  if (mode !== 'master') return
  const adminEmail = requiredEnv('ADMIN_EMAIL').toLocaleLowerCase('en-US')
  if (targetUser.email?.toLocaleLowerCase('en-US') !== adminEmail) {
    throw new Error('master mode の --to は ADMIN_EMAIL の Firebase Auth UID である必要があります')
  }
}

async function fetchUserDocuments(
  db: Firestore,
  collection: CopyCollection,
  uid: string,
): Promise<CopyDocument[]> {
  const snapshot = await db.collection(collection).where('user_id', '==', uid).get()
  return snapshot.docs.map(document => ({
    id: document.id,
    data: { ...document.data() } as Record<string, unknown>,
  }))
}

async function fetchSnapshot(
  db: Firestore,
  collections: CopyCollection[],
  uid: string,
): Promise<CopySnapshot> {
  const snapshot = emptyCopySnapshot()
  const results = await Promise.all(
    collections.map(async collection => ({
      collection,
      documents: await fetchUserDocuments(db, collection, uid),
    })),
  )
  for (const result of results) snapshot[result.collection] = result.documents
  return snapshot
}

function printPlan(plan: CopyPlan, mode: CopyMode): void {
  console.log('\nコピー計画:')
  console.log('  collection             created  reused  skipped')
  for (const collection of collectionsForMode(mode)) {
    const row = plan.summary[collection]
    console.log(
      `  ${collection.padEnd(22)} ${String(row.created).padStart(7)} ` +
      `${String(row.reused).padStart(7)} ${String(row.skipped).padStart(8)}`,
    )
  }

  if (plan.duplicateEntries.length > 0) {
    console.warn('\n重複語としてスキップする entries:')
    for (const duplicate of plan.duplicateEntries) console.warn(`  - ${duplicate}`)
  }
  if (plan.warnings.length > 0) {
    console.warn('\n警告:')
    for (const warning of plan.warnings) console.warn(`  - ${warning}`)
  }
}

async function printStudyLanguageWarnings(
  db: Firestore,
  targetUid: string,
  operations: CopyOperation[],
): Promise<void> {
  const copiedLanguages = new Set(
    operations
      .filter(operation => operation.collection === 'entries')
      .map(operation => operation.data.language)
      .filter((language): language is string => typeof language === 'string' && language.trim().length > 0),
  )
  if (copiedLanguages.size === 0) return

  const settings = await db.collection('settings').doc(targetUid).get()
  const studyLanguages = normalizeStudyLanguages(settings.exists ? settings.data()?.study_languages : undefined)
  const missing = [...copiedLanguages]
    .filter(language => !resolveStudyLanguage(language, studyLanguages))
    .sort((left, right) => left.localeCompare(right))
  if (missing.length === 0) return

  console.warn('\n学習言語の確認:')
  for (const language of missing) {
    console.warn(`  - コピー先ユーザーは Settings で言語 "${language}" を有効にしてください。`)
  }
}

function chunkOperations(operations: CopyOperation[]): CopyOperation[][] {
  const chunks: CopyOperation[][] = []
  for (let offset = 0; offset < operations.length; offset += WRITE_BATCH_SIZE) {
    chunks.push(operations.slice(offset, offset + WRITE_BATCH_SIZE))
  }
  return chunks
}

async function executePlan(db: Firestore, operations: CopyOperation[]): Promise<void> {
  const batches = chunkOperations(operations).map(chunk => {
    const batch = db.batch()
    for (const operation of chunk) {
      batch.create(db.collection(operation.collection).doc(operation.id), operation.data)
    }
    return batch
  })
  await Promise.all(batches.map(batch => batch.commit()))
}

function sourceDocumentCount(snapshot: CopySnapshot, mode: CopyMode): number {
  return collectionsForMode(mode).reduce((count, collection) => count + snapshot[collection].length, 0)
}

export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  const parsed = parseCopyUserDataArgs(args)
  if (parsed.help) {
    printUsage()
    return
  }

  const projectId = requiredEnv('FIREBASE_ADMIN_PROJECT_ID')
  const clientEmail = requiredEnv('FIREBASE_ADMIN_CLIENT_EMAIL')
  const privateKey = requiredEnv('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n')
  const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  const auth = getAuth(app)
  const db = getFirestore(app)

  console.log(`${parsed.apply ? 'APPLY' : 'DRY RUN'}: ユーザー間データコピー`)
  console.log(`Project: ${projectId}`)
  console.log(`Mode: ${parsed.mode}`)
  console.log(`From: ${parsed.fromUid}`)
  console.log(`To: ${parsed.toUid}`)

  const [, targetUser] = await loadAuthUsers(auth, parsed.fromUid, parsed.toUid)
  assertMasterTargetIsAdmin(parsed.mode, targetUser)
  const collections = collectionsForMode(parsed.mode)
  const [source, target] = await Promise.all([
    fetchSnapshot(db, collections, parsed.fromUid),
    fetchSnapshot(db, collections, parsed.toUid),
  ])
  if (sourceDocumentCount(source, parsed.mode) === 0) {
    console.warn('\nコピー元に対象データがありません。書き込みなしで終了します。')
    return
  }

  const plan = buildCopyPlan({
    mode: parsed.mode,
    targetUid: parsed.toUid,
    source,
    target,
    now: new Date(),
    createId: collection => db.collection(collection).doc().id,
  })
  printPlan(plan, parsed.mode)
  if (parsed.mode === 'full') await printStudyLanguageWarnings(db, parsed.toUid, plan.operations)

  if (plan.operations.length === 0) {
    console.log('\n新規作成はありません。')
    return
  }
  if (!parsed.apply) {
    console.log(`\nDRY RUN 完了: ${plan.operations.length} 件を作成予定。Firestore への書き込みはありません。`)
    console.log('内容を確認し、明示的な承認後にのみ --apply を付けて再実行してください。')
    return
  }

  await executePlan(db, plan.operations)
  console.log(`\nAPPLY 完了: ${plan.operations.length} 件を作成しました。`)
  console.log('同じ引数で dry-run を再実行し、created が 0 であることを確認してください。')
}

const executedFile = process.argv[1] ? pathToFileURL(process.argv[1]).href : null
if (executedFile === import.meta.url) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`コピーに失敗しました: ${message}`)
    process.exitCode = 1
  })
}
