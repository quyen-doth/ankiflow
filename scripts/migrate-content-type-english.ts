/**
 * Built-in global/user Content Type の既知の旧ベトナム語デフォルトだけを英語化する。
 *
 * Usage:
 *   npm run migrate:content-type-english             # dry-run (read-only)
 *   npm run migrate:content-type-english -- --apply  # explicit Firestore writes
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env', quiet: true })

import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { pathToFileURL } from 'node:url'
import {
  buildContentTypeEnglishMigrationPlan,
  executeContentTypeEnglishMigration,
  fetchContentTypeEnglishMigrationDocuments,
  parseContentTypeEnglishMigrationArgs,
  type ContentTypeEnglishMigrationPlan,
} from '../lib/content-type-english-migration'

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function printUsage(): void {
  console.log('Usage: npm run migrate:content-type-english -- [--apply]')
  console.log('  default  Preview exact legacy-text replacements; no Firestore writes')
  console.log('  --apply  Update reviewed built-in documents after a transaction re-read')
}

function printPlan(plan: ContentTypeEnglishMigrationPlan): void {
  const globalCandidates = plan.candidates.filter(candidate => candidate.scope === 'global')
  const userCandidates = plan.candidates.filter(candidate => candidate.scope === 'user')
  console.log(`Scanned global documents: ${plan.scannedGlobal}`)
  console.log(`Scanned user documents: ${plan.scannedUser}`)
  console.log(`Global update candidates: ${globalCandidates.length}`)
  console.log(`User update candidates: ${userCandidates.length}`)
  console.log(`Skipped already English: ${plan.skippedAlreadyEnglish}`)
  console.log(`Skipped customized/malformed built-ins: ${plan.skippedCustomized}`)
  console.log(`Skipped unsupported/custom codes: ${plan.skippedUnsupported}`)

  if (plan.skippedCustomizedPaths.length > 0) {
    console.log('\nPRESERVED CUSTOMIZED/MALFORMED:')
    for (const path of plan.skippedCustomizedPaths) console.log(`  ${path}`)
  }
  if (plan.skippedUnsupportedPaths.length > 0) {
    console.log('\nSKIPPED UNSUPPORTED/CUSTOM:')
    for (const path of plan.skippedUnsupportedPaths) console.log(`  ${path}`)
  }

  if (plan.candidates.length === 0) return
  console.log('\nUPDATE:')
  for (const candidate of plan.candidates) {
    console.log(`  ${candidate.path}: ${candidate.changes.join(', ')}`)
  }
}

export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  const parsedArgs = parseContentTypeEnglishMigrationArgs(args)
  if (parsedArgs.help) {
    printUsage()
    return
  }

  const projectId = requiredEnv('FIREBASE_ADMIN_PROJECT_ID')
  const clientEmail = requiredEnv('FIREBASE_ADMIN_CLIENT_EMAIL')
  const privateKey = requiredEnv('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n')
  const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  const db = getFirestore(app)

  console.log(`${parsedArgs.apply ? 'APPLY' : 'DRY RUN'}: translate legacy built-in Content Type text`)
  console.log(`Project: ${projectId}\n`)

  const documents = await fetchContentTypeEnglishMigrationDocuments(db)
  const plan = buildContentTypeEnglishMigrationPlan(documents)
  printPlan(plan)

  if (!parsedArgs.apply) {
    console.log(`\nDRY RUN complete: ${plan.candidates.length} update(s), no Firestore writes performed.`)
    if (plan.candidates.length > 0) {
      console.log('Review this output, then rerun with --apply only after explicit approval.')
    }
    return
  }

  const result = await executeContentTypeEnglishMigration(db, plan)
  console.log('\nAPPLY result:')
  console.log(`  updated: ${result.updated}`)
  console.log(`  skipped after re-read: ${result.skippedAfterReread}`)
  console.log(`  failed: ${result.failed.length}`)
  for (const failure of result.failed) console.error(`  ${failure.path}: ${failure.message}`)
  if (result.failed.length > 0) process.exitCode = 1

  const verificationDocuments = await fetchContentTypeEnglishMigrationDocuments(db)
  const verificationPlan = buildContentTypeEnglishMigrationPlan(verificationDocuments)
  console.log(
    `\nPost-apply verification: ${verificationPlan.candidates.length} `
    + 'update candidate(s) remaining (expected 0).',
  )
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
