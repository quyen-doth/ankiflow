/**
 * Existing Firebase Auth users に global Content Types の不足分だけを backfill する。
 *
 * Usage:
 *   npm run migrate:user-content-types             # dry-run (read-only)
 *   npm run migrate:user-content-types -- --apply  # create-only writes
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env', quiet: true })

import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { pathToFileURL } from 'node:url'
import {
  buildUserContentTypeMigrationPlan,
  executeUserContentTypeMigration,
  fetchExistingUserContentTypes,
  fetchGlobalContentTypesForMigration,
  listAllMigrationUserIds,
  parseUserContentTypeMigrationArgs,
  type UserContentTypeMigrationPlan,
} from '../lib/user-content-type-migration'
import { USER_CONTENT_TYPES_COLLECTION } from '../lib/constants'

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function printUsage(): void {
  console.log('Usage: npm run migrate:user-content-types -- [--apply]')
  console.log('  default  Preview create-only migration; no Firestore writes')
  console.log('  --apply  Create the reviewed missing user Content Types')
}

function printPlan(plan: UserContentTypeMigrationPlan): void {
  console.log(`Auth users: ${plan.targetUserCount}`)
  console.log(`Global defaults: ${plan.globalDefaultCount}`)
  console.log(`Create candidates: ${plan.creates.length}`)
  console.log(`Skipped by deterministic ID: ${plan.skippedById}`)
  console.log(`Skipped by workspace code: ${plan.skippedByCode}`)

  if (plan.creates.length === 0) return
  console.log('\nCREATE:')
  for (const candidate of plan.creates) {
    console.log(`  ${USER_CONTENT_TYPES_COLLECTION}/${candidate.id}`)
  }
}

export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  const parsedArgs = parseUserContentTypeMigrationArgs(args)
  if (parsedArgs.help) {
    printUsage()
    return
  }

  const projectId = requiredEnv('FIREBASE_ADMIN_PROJECT_ID')
  const clientEmail = requiredEnv('FIREBASE_ADMIN_CLIENT_EMAIL')
  const privateKey = requiredEnv('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n')
  const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  const auth = getAuth(app)
  const db = getFirestore(app)

  console.log(`${parsedArgs.apply ? 'APPLY' : 'DRY RUN'}: backfill user Content Types`)
  console.log(`Project: ${projectId}\n`)

  const [userIds, sources] = await Promise.all([
    listAllMigrationUserIds(auth),
    fetchGlobalContentTypesForMigration(db),
  ])
  const existing = await fetchExistingUserContentTypes(db, userIds)
  const plan = buildUserContentTypeMigrationPlan(sources, userIds, existing)
  printPlan(plan)

  if (!parsedArgs.apply) {
    console.log(`\nDRY RUN complete: ${plan.creates.length} create(s), no Firestore writes performed.`)
    if (plan.creates.length > 0) {
      console.log('Review this output, then rerun with --apply only after explicit approval.')
    }
    return
  }

  const result = await executeUserContentTypeMigration(db, plan)
  const plannedSkipped = plan.skippedById + plan.skippedByCode
  console.log('\nAPPLY result:')
  console.log(`  created: ${result.created}`)
  console.log(`  skipped: ${plannedSkipped + result.skippedExisting}`)
  console.log(`    planned existing: ${plannedSkipped}`)
  console.log(`    concurrent existing: ${result.skippedExisting}`)
  console.log(`  failed: ${result.failed.length}`)
  for (const failure of result.failed) {
    console.error(`  ${failure.path}: ${failure.errorCode}`)
  }
  if (result.failed.length > 0) process.exitCode = 1

  // Read-back: writes が実際に永続化されたか、planner を再実行して確認する。
  const verifyExisting = await fetchExistingUserContentTypes(db, userIds)
  const verifyPlan = buildUserContentTypeMigrationPlan(sources, userIds, verifyExisting)
  console.log(`\nPost-apply verification: ${verifyPlan.creates.length} create candidate(s) remaining (expected 0).`)
  if (verifyPlan.creates.length > 0) {
    console.error('Migration did not reach zero-create state; investigate before rerunning.')
    process.exitCode = 1
  }
}

const executedFile = process.argv[1] ? pathToFileURL(process.argv[1]).href : null
if (executedFile === import.meta.url) {
  // tsx は CJS へ transpile するため top-level await は使えない。main() の pending I/O
  // が event loop を維持し、末尾の read-back verification が flush 完了を保証する。
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Migration failed: ${message}`)
    process.exitCode = 1
  })
}
