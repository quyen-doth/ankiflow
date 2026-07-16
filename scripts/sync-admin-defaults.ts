/**
 * One-time migration: copy the ADMIN_EMAIL user's /admin "My workspace" master data
 * into the exact `__defaults__` template snapshot.
 *
 * Usage:
 *   npx tsx scripts/sync-admin-defaults.ts          # dry-run (no writes)
 *   npx tsx scripts/sync-admin-defaults.ts --apply  # write template changes
 *   npx tsx scripts/sync-admin-defaults.ts --apply --allow-empty
 *                                                   # explicitly allow emptying template collections
 *
 * Existing users receive missing documents only; their current documents are never
 * updated or deleted. Never run --apply without reviewing the dry-run output and
 * receiving explicit approval for Firestore writes/deletes.
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env' })

import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import {
  ADMIN_DEFAULT_COLLECTIONS,
  assertEmptyTemplateCollectionsAllowed,
  buildAdminDefaultSnapshot,
  buildTemplateSyncPlan,
  buildUserBackfillPlan,
  backfillTargetUserIds,
  executeTemplateSyncPlan,
  executeUserBackfillPlan,
  fetchOwnedWorkspaceSnapshot,
  listAllAuthUserIds,
  parseSyncAdminDefaultsArgs,
  templateCollectionsEmptiedBySync,
  templateSyncOperationCount,
  type TemplateSyncPlan,
  type UserBackfillPlan,
} from '../lib/admin-default-sync'
import { DEFAULTS_OWNER_ID } from '../lib/constants'

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function printUsage(): void {
  console.log('Usage: npx tsx scripts/sync-admin-defaults.ts [--apply] [--allow-empty]')
  console.log('  default   Preview exact __defaults__ and existing-user backfill changes')
  console.log('  --apply   Apply reviewed template changes and missing-user creates')
  console.log('  --allow-empty  Confirm that --apply may empty one or more template collections')
}

function operationCountByCollection(
  operations: Array<{ collection: (typeof ADMIN_DEFAULT_COLLECTIONS)[number] }>,
  collection: (typeof ADMIN_DEFAULT_COLLECTIONS)[number],
): number {
  return operations.filter((operation) => operation.collection === collection).length
}

function printPlan(plan: TemplateSyncPlan): void {
  console.log('\nTemplate diff:')
  for (const collection of ADMIN_DEFAULT_COLLECTIONS) {
    console.log(
      `  ${collection}: +${operationCountByCollection(plan.creates, collection)} ` +
      `~${operationCountByCollection(plan.updates, collection)} ` +
      `-${operationCountByCollection(plan.deletes, collection)}`,
    )
  }

  const sections = [
    { label: 'CREATE', operations: plan.creates },
    { label: 'UPDATE', operations: plan.updates },
    { label: 'DELETE', operations: plan.deletes },
  ]
  for (const section of sections) {
    if (section.operations.length === 0) continue
    console.log(`\n${section.label}:`)
    for (const operation of section.operations) console.log(`  ${operation.collection}/${operation.id}`)
  }
}

function printBackfillPlan(plan: UserBackfillPlan): void {
  const affectedUsers = new Set(plan.creates.map((operation) => operation.userId)).size
  console.log('\nExisting-user backfill:')
  console.log(`  target users: ${plan.targetUserCount}`)
  console.log(`  affected users: ${affectedUsers}`)
  for (const collection of ADMIN_DEFAULT_COLLECTIONS) {
    console.log(`  ${collection}: +${operationCountByCollection(plan.creates, collection)}`)
  }
  if (plan.creates.length > 0) {
    console.log('\nBACKFILL CREATE:')
    for (const operation of plan.creates) console.log(`  ${operation.collection}/${operation.id}`)
  }
}

async function main(): Promise<void> {
  const args = parseSyncAdminDefaultsArgs(process.argv.slice(2))
  if (args.help) {
    printUsage()
    return
  }

  const projectId = requiredEnv('FIREBASE_ADMIN_PROJECT_ID')
  const clientEmail = requiredEnv('FIREBASE_ADMIN_CLIENT_EMAIL')
  const privateKey = requiredEnv('FIREBASE_ADMIN_PRIVATE_KEY').replace(/\\n/g, '\n')
  const adminEmail = requiredEnv('ADMIN_EMAIL')

  const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
  const auth = getAuth(app)
  const db = getFirestore(app)
  const admin = await auth.getUserByEmail(adminEmail)

  console.log(`${args.apply ? 'APPLY' : 'DRY RUN'}: synchronize admin workspace defaults`)
  console.log(`Project: ${projectId}`)
  console.log(`Admin: ${admin.email ?? adminEmail} (${admin.uid})`)

  const [adminWorkspace, currentTemplates, allUserIds] = await Promise.all([
    fetchOwnedWorkspaceSnapshot(db, admin.uid),
    fetchOwnedWorkspaceSnapshot(db, DEFAULTS_OWNER_ID),
    listAllAuthUserIds(auth),
  ])
  const desiredTemplates = buildAdminDefaultSnapshot(adminWorkspace, admin.uid)
  const templatePlan = buildTemplateSyncPlan(desiredTemplates, currentTemplates)
  const emptiedCollections = templateCollectionsEmptiedBySync(desiredTemplates, currentTemplates)
  const targetUserIds = backfillTargetUserIds(allUserIds, admin.uid)
  const backfillPlan = await buildUserBackfillPlan(db, desiredTemplates, targetUserIds)

  console.log('\nAdmin source:')
  for (const collection of ADMIN_DEFAULT_COLLECTIONS) {
    console.log(`  ${collection}: ${adminWorkspace[collection].length}`)
  }
  printPlan(templatePlan)
  printBackfillPlan(backfillPlan)

  if (emptiedCollections.length > 0) {
    console.warn(`\nWARNING: this synchronization will empty: ${emptiedCollections.join(', ')}`)
    console.warn('Use --allow-empty together with --apply only when this is intentional.')
  }

  const templateOperationCount = templateSyncOperationCount(templatePlan)
  const operationCount = templateOperationCount + backfillPlan.creates.length
  if (operationCount === 0) {
    console.log('\nNo synchronization changes are required.')
    return
  }
  if (!args.apply) {
    console.log(`\nDRY RUN complete: ${operationCount} operation(s), no Firestore writes performed.`)
    console.log('Review this output, then rerun with --apply after explicit approval.')
    return
  }
  assertEmptyTemplateCollectionsAllowed(emptiedCollections, args.allowEmpty)

  await executeTemplateSyncPlan(db, templatePlan)
  const backfillResult = await executeUserBackfillPlan(db, backfillPlan)
  console.log(
    `\nApplied ${templateOperationCount} template operation(s) and ` +
    `${backfillResult.created} user backfill create(s); ` +
    `${backfillResult.skippedExisting} concurrent existing document(s) skipped.`,
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Sync failed: ${message}`)
  process.exitCode = 1
})
