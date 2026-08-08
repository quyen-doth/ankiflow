/**
 * Assigns legacy single-user data to a Firebase Auth account.
 *
 * Usage:
 *   npx tsx scripts/migrate-user-data.ts <UID>
 *   npx tsx scripts/migrate-user-data.ts <UID> --dry-run  # count without writing
 *
 * Behavior:
 * 1. In entries, categories, card_types, topics, and decks, documents whose
 *    `user_id` is missing or equals `local-user` are assigned to the supplied UID.
 *    Document IDs remain unchanged because entries retain card-type ID references.
 * 2. If settings/{UID} is missing, it is created from settings/default after
 *    system fields, LINE credentials, and user_name are removed.
 * 3. Shared content_types documents are not modified.
 *
 * This one-time migration is idempotent and only updates remaining legacy documents.
 */

import { FIREBASE_ADMIN_ENV_NAMES, loadEnv } from './lib/load-env'
loadEnv({ required: FIREBASE_ADMIN_ENV_NAMES })

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

const LEGACY_USER_ID = 'local-user'
const COLLECTIONS = ['entries', 'categories', 'card_types', 'topics', 'decks']
const STRIP_FROM_USER_SETTINGS = [
  'ai_model',
  'web_search_enabled',
  'line_channel_access_token',
  'line_user_id',
  'notifications_enabled',
  'user_name',
]

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
})
const db: Firestore = getFirestore(app)

async function migrateCollection(name: string, uid: string, dryRun: boolean): Promise<number> {
  const snapshot = await db.collection(name).get()
  const targets = snapshot.docs.filter((d) => {
    const owner = d.data().user_id
    return owner === undefined || owner === null || owner === LEGACY_USER_ID
  })

  if (targets.length === 0 || dryRun) return targets.length

  // Firestoreのバッチ書き込み上限に合わせて500件ずつ処理する。
  for (let i = 0; i < targets.length; i += 500) {
    const batch = db.batch()
    for (const d of targets.slice(i, i + 500)) {
      batch.update(d.ref, { user_id: uid })
    }
    await batch.commit()
  }
  return targets.length
}

async function migrateSettings(uid: string, dryRun: boolean): Promise<string> {
  const userRef = db.collection('settings').doc(uid)
  const userSnap = await userRef.get()
  if (userSnap.exists) return '既に存在するためスキップ'

  const defSnap = await db.collection('settings').doc('default').get()
  if (!defSnap.exists) return 'settings/defaultが存在しないためスキップ'

  const prefs: Record<string, unknown> = { ...defSnap.data() }
  for (const key of STRIP_FROM_USER_SETTINGS) delete prefs[key]
  prefs.updated_at = new Date()

  if (!dryRun) await userRef.set(prefs)
  return 'settings/defaultから作成（システム・LINEフィールドを除外）'
}

async function main() {
  const uid = process.argv[2]
  const dryRun = process.argv.includes('--dry-run')

  if (!uid || uid.startsWith('--')) {
    console.error('❌ UIDが必要です。使用方法: npx tsx scripts/migrate-user-data.ts <UID> [--dry-run]')
    console.error('   Firebase Console → Authentication → Users の User UID を確認してください。')
    process.exit(1)
  }

  console.log(`🚀 single-userデータをUID: ${uid}へ移行します${dryRun ? ' (DRY RUN)' : ''}`)
  console.log(`   プロジェクト: ${process.env.FIREBASE_ADMIN_PROJECT_ID}\n`)

  for (const name of COLLECTIONS) {
    const count = await migrateCollection(name, uid, dryRun)
    console.log(`  ${dryRun ? '🔍' : '✅'} ${name}: ${count}件のドキュメントにuser_idを${dryRun ? '割り当てる予定' : '割り当てました'}`)
  }

  const settingsResult = await migrateSettings(uid, dryRun)
  console.log(`  ${dryRun ? '🔍' : '✅'} settings/${uid}: ${settingsResult}`)

  console.log('\n✨ 移行が完了しました。')
  if (dryRun) console.log('   (dry-runのため書き込みなし。適用するには--dry-runを外して再実行してください。)')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ エラー:', err.message)
  process.exit(1)
})
