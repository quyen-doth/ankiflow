/**
 * 既存 Content Type snapshot に data-driven AI Output Language control を補う one-time migration。
 *
 * Usage:
 *   npm run migrate:output-language-controls
 *   npm run migrate:output-language-controls -- --uid <uid>
 *   npm run migrate:output-language-controls -- --uid <uid> --apply
 */

import { FIREBASE_ADMIN_ENV_NAMES, loadEnv } from './lib/load-env'

import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { pathToFileURL } from 'node:url'
import {
  buildOutputLanguageControlBackfillPlan,
  executeOutputLanguageControlBackfill,
  fetchOutputLanguageControlBackfillDocuments,
  parseOutputLanguageControlBackfillArgs,
  type OutputLanguageControlBackfillPlan,
} from '../lib/output-language-control-backfill'

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function printUsage(): void {
  console.log('Usage: npm run migrate:output-language-controls -- [--uid <uid>] [--apply]')
  console.log('  default      Preview merge-only field updates for all users; no Firestore writes')
  console.log('  --uid <uid>  Limit user snapshot reads/updates to one Firebase Auth UID')
  console.log('  --apply      Apply only the reviewed missing controls')
}

function printPlan(plan: OutputLanguageControlBackfillPlan): void {
  const globalCandidates = plan.candidates.filter(candidate => candidate.scope === 'global')
  const userCandidates = plan.candidates.filter(candidate => candidate.scope === 'user')
  console.log(`Scanned global Content Types: ${plan.scannedGlobal}`)
  console.log(`Scanned user Content Types: ${plan.scannedUser}`)
  console.log(`Global update candidates: ${globalCandidates.length}`)
  console.log(`User update candidates: ${userCandidates.length}`)
  console.log(`Skipped already configured: ${plan.skippedConfigured}`)
  console.log(`Skipped unlinked custom Content Types: ${plan.skippedUnlinked}`)
  console.log(`Skipped sources without output control: ${plan.skippedWithoutSourceControl}`)
  console.log(`Conflicts requiring manual review: ${plan.conflicts.length}`)

  if (plan.conflicts.length > 0) {
    console.log('\nPRESERVED CONFLICTS:')
    for (const conflict of plan.conflicts) {
      console.log(`  ${conflict.path}: ${conflict.reason}`)
    }
  }

  if (plan.candidates.length === 0) return
  console.log('\nUPDATE:')
  for (const candidate of plan.candidates) {
    console.log(
      `  ${candidate.path}: add ${candidate.desiredField.field_key} `
      + `(data_source=${candidate.desiredField.data_source})`,
    )
  }
}

export async function main(args: string[] = process.argv.slice(2)): Promise<void> {
  const parsedArgs = parseOutputLanguageControlBackfillArgs(args)
  if (parsedArgs.help) {
    printUsage()
    return
  }

  loadEnv({ required: FIREBASE_ADMIN_ENV_NAMES })
  const projectId = requiredEnv('FIREBASE_ADMIN_PROJECT_ID')
  const clientEmail = requiredEnv('FIREBASE_ADMIN_CLIENT_EMAIL')
  const privateKey = requiredEnv('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n')
  const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  const db = getFirestore(app)
  const target = parsedArgs.uid ? `user ${parsedArgs.uid}` : 'all existing users'

  console.log(`${parsedArgs.apply ? 'APPLY' : 'DRY RUN'}: backfill AI Output Language controls`)
  console.log(`Project: ${projectId}`)
  console.log(`Target: ${target}\n`)

  const documents = await fetchOutputLanguageControlBackfillDocuments(db, parsedArgs.uid)
  const plan = buildOutputLanguageControlBackfillPlan(
    documents.globalDocuments,
    documents.userDocuments,
  )
  printPlan(plan)

  if (!parsedArgs.apply) {
    console.log(
      `\nDRY RUN complete: ${plan.candidates.length} update(s), `
      + 'no Firestore writes performed.',
    )
    if (plan.candidates.length > 0) {
      console.log('Review every path, then rerun with --apply only after explicit approval.')
    }
    return
  }

  const result = await executeOutputLanguageControlBackfill(db, plan)
  console.log('\nAPPLY result:')
  console.log(`  updated: ${result.updated}`)
  console.log(`  skipped already configured after re-read: ${result.skippedConfigured}`)
  console.log(`  skipped conflicting after re-read: ${result.skippedConflicting}`)
  console.log(`  failed: ${result.failed.length}`)
  for (const failure of result.failed) {
    console.error(`  ${failure.path}: ${failure.message}`)
  }
  if (result.failed.length > 0) process.exitCode = 1

  const verificationDocuments = await fetchOutputLanguageControlBackfillDocuments(
    db,
    parsedArgs.uid,
  )
  const verificationPlan = buildOutputLanguageControlBackfillPlan(
    verificationDocuments.globalDocuments,
    verificationDocuments.userDocuments,
  )
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
