/**
 * Entry query metadata の collision preflight と guarded backfill。
 *
 * Usage:
 *   npm run migrate:entry-query-fields             # dry-run (read-only)
 *   npm run migrate:entry-query-fields -- --apply  # explicit Firestore writes
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env', quiet: true })

import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { pathToFileURL } from 'node:url'
import {
  buildEntryQueryMigrationPlan,
  executeEntryQueryMigration,
  fetchEntryQueryMigrationInput,
  markEntryQuerySchemaReady,
  parseEntryQueryMigrationArgs,
  type EntryQueryMigrationPlan,
} from '../lib/entries/queryMetadataMigration'

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function printUsage(): void {
  console.log('Usage: npm run migrate:entry-query-fields -- [--apply]')
  console.log('  default  Scan Entry/Content Type collisions and preview metadata updates')
  console.log('  --apply  Apply guarded Entry updates and mark the global schema ready')
}

function printPlan(plan: EntryQueryMigrationPlan): void {
  console.log(`Scanned Entries: ${plan.scannedEntries}`)
  console.log(`Scanned Content Types: ${plan.scannedContentTypes}`)
  console.log(`Already current: ${plan.unchangedEntries}`)
  console.log(`Update candidates: ${plan.candidates.length}`)
  console.log(`Collisions: ${plan.collisions.length}`)

  if (plan.collisions.length > 0) {
    console.log('\nCOLLISIONS (must be resolved before apply):')
    for (const collision of plan.collisions) {
      console.log(`  ${collision.path}: ${collision.reason} [${collision.fields.join(', ')}]`)
    }
  }

  if (plan.candidates.length > 0) {
    console.log('\nUPDATE:')
    for (const candidate of plan.candidates) {
      console.log(`  ${candidate.path}`)
    }
  }
}

export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  const parsedArgs = parseEntryQueryMigrationArgs(args)
  if (parsedArgs.help) {
    printUsage()
    return
  }

  const projectId = requiredEnv('FIREBASE_ADMIN_PROJECT_ID')
  const clientEmail = requiredEnv('FIREBASE_ADMIN_CLIENT_EMAIL')
  const privateKey = requiredEnv('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n')
  const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  const db = getFirestore(app)

  console.log(`${parsedArgs.apply ? 'APPLY' : 'DRY RUN'}: Entry query metadata`)
  console.log(`Project: ${projectId}\n`)

  const input = await fetchEntryQueryMigrationInput(db)
  const plan = buildEntryQueryMigrationPlan(input)
  printPlan(plan)

  if (!parsedArgs.apply) {
    console.log('\nDRY RUN complete: no Firestore writes performed.')
    if (plan.collisions.length > 0) {
      console.log('Resolve every collision before deploying query metadata writers.')
    } else if (plan.candidates.length > 0) {
      console.log('Review this output, then rerun with --apply only after explicit approval.')
    }
    return
  }

  if (plan.collisions.length > 0) {
    throw new Error('Refusing to apply while Entry query metadata collisions remain')
  }

  const result = await executeEntryQueryMigration(db, plan)
  console.log('\nAPPLY result:')
  console.log(`  updated: ${result.updated}`)
  console.log(`  failed: ${result.failures.length}`)
  for (const failure of result.failures) {
    console.error(`  ${failure.path}: ${failure.message}`)
  }

  const verificationInput = await fetchEntryQueryMigrationInput(db)
  const verificationPlan = buildEntryQueryMigrationPlan(verificationInput)
  console.log(`\nPost-apply candidates: ${verificationPlan.candidates.length} (expected 0)`)
  console.log(`Post-apply collisions: ${verificationPlan.collisions.length} (expected 0)`)

  const ready = result.failures.length === 0
    && verificationPlan.candidates.length === 0
    && verificationPlan.collisions.length === 0
  if (!ready) {
    console.error('Global schema marker was not updated. Resolve failures and rerun.')
    process.exitCode = 1
    return
  }

  await markEntryQuerySchemaReady(db)
  console.log('Global Entry query schema marker updated.')
}

const executedFile = process.argv[1] ? pathToFileURL(process.argv[1]).href : null
if (executedFile === import.meta.url) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Migration failed: ${message}`)
    process.exitCode = 1
  })
}
