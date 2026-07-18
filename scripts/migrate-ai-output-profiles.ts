/**
 * Built-in global/user Content Type documents に AI output profiles を merge-only backfill する。
 *
 * Usage:
 *   npm run migrate:ai-output-profiles             # dry-run (read-only)
 *   npm run migrate:ai-output-profiles -- --apply  # explicit Firestore writes
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env', quiet: true })

import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { pathToFileURL } from 'node:url'
import {
  buildAiOutputProfileMigrationPlan,
  executeAiOutputProfileMigration,
  fetchAiOutputProfileMigrationDocuments,
  parseAiOutputProfileMigrationArgs,
  type AiOutputProfileMigrationPlan,
} from '../lib/ai-output-profile-migration'

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function printUsage(): void {
  console.log('Usage: npm run migrate:ai-output-profiles -- [--apply]')
  console.log('  default  Preview merge-only output profile updates; no Firestore writes')
  console.log('  --apply  Update only built-in documents that still have no profile field')
}

function printPlan(plan: AiOutputProfileMigrationPlan): void {
  const globalCandidates = plan.candidates.filter(candidate => candidate.scope === 'global')
  const userCandidates = plan.candidates.filter(candidate => candidate.scope === 'user')
  console.log(`Scanned global documents: ${plan.scannedGlobal}`)
  console.log(`Scanned user documents: ${plan.scannedUser}`)
  console.log(`Global update candidates: ${globalCandidates.length}`)
  console.log(`User update candidates: ${userCandidates.length}`)
  console.log(`Skipped already configured: ${plan.skippedConfigured}`)
  console.log(`Skipped unsupported/custom/local: ${plan.skippedUnsupported}`)

  if (plan.candidates.length === 0) return
  console.log('\nUPDATE:')
  for (const candidate of plan.candidates) {
    console.log(`  ${candidate.path} (${candidate.formType})`)
  }
}

export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  const parsedArgs = parseAiOutputProfileMigrationArgs(args)
  if (parsedArgs.help) {
    printUsage()
    return
  }

  const projectId = requiredEnv('FIREBASE_ADMIN_PROJECT_ID')
  const clientEmail = requiredEnv('FIREBASE_ADMIN_CLIENT_EMAIL')
  const privateKey = requiredEnv('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n')
  const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  const db = getFirestore(app)

  console.log(`${parsedArgs.apply ? 'APPLY' : 'DRY RUN'}: backfill AI output profiles`)
  console.log(`Project: ${projectId}\n`)

  const documents = await fetchAiOutputProfileMigrationDocuments(db)
  const plan = buildAiOutputProfileMigrationPlan(documents)
  printPlan(plan)

  if (!parsedArgs.apply) {
    console.log(`\nDRY RUN complete: ${plan.candidates.length} update(s), no Firestore writes performed.`)
    if (plan.candidates.length > 0) {
      console.log('Review this output, then rerun with --apply only after explicit approval.')
    }
    return
  }

  const result = await executeAiOutputProfileMigration(db, plan)
  console.log('\nAPPLY result:')
  console.log(`  updated: ${result.updated}`)
  console.log(`  skipped after re-read: ${result.skippedConfigured}`)
  console.log(`  failed: ${result.failed.length}`)
  for (const failure of result.failed) {
    console.error(`  ${failure.path}: ${failure.message}`)
  }
  if (result.failed.length > 0) process.exitCode = 1

  const verificationDocuments = await fetchAiOutputProfileMigrationDocuments(db)
  const verificationPlan = buildAiOutputProfileMigrationPlan(verificationDocuments)
  console.log(`\nPost-apply verification: ${verificationPlan.candidates.length} update candidate(s) remaining (expected 0).`)
  if (verificationPlan.candidates.length > 0) process.exitCode = 1
}

const executedFile = process.argv[1] ? pathToFileURL(process.argv[1]).href : null
if (executedFile === import.meta.url) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Migration failed: ${message}`)
    process.exitCode = 1
  })
}
