/**
 * scripts/migrate-user-data.ts — M2 của firebase-auth-plan.
 * Gán toàn bộ dữ liệu cũ (single-user era) cho một tài khoản Firebase Auth.
 *
 * Cách chạy:
 *   npx tsx scripts/migrate-user-data.ts <UID>
 *   npx tsx scripts/migrate-user-data.ts <UID> --dry-run   (chỉ đếm, không ghi)
 *
 * Việc thực hiện:
 * 1. 6 collections (entries, categories, card_types, topics, decks,
 *    notification_triggers): mọi doc có user_id == 'local-user' HOẶC THIẾU
 *    user_id → set user_id = <UID>. (Doc ID giữ nguyên — entries đang tham
 *    chiếu card_type_ids theo ID cũ nên KHÔNG được đổi ID.)
 * 2. settings/{UID}: nếu chưa có → tạo từ settings/default, STRIP system
 *    fields (ai_model, web_search_enabled) + LINE credentials + user_name.
 * 3. content_types: KHÔNG đụng (shared — doc id = form_type routing).
 *
 * One-time, idempotent (chạy lại chỉ update những doc còn sót).
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env' })

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'

const LEGACY_USER_ID = 'local-user'
const COLLECTIONS = ['entries', 'categories', 'card_types', 'topics', 'decks', 'notification_triggers']
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

  // Firestore batch giới hạn 500 writes
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
  if (userSnap.exists) return 'đã tồn tại — bỏ qua'

  const defSnap = await db.collection('settings').doc('default').get()
  if (!defSnap.exists) return 'settings/default không tồn tại — bỏ qua'

  const prefs: Record<string, unknown> = { ...defSnap.data() }
  for (const key of STRIP_FROM_USER_SETTINGS) delete prefs[key]
  prefs.updated_at = new Date()

  if (!dryRun) await userRef.set(prefs)
  return 'đã tạo từ settings/default (strip system + LINE fields)'
}

async function main() {
  const uid = process.argv[2]
  const dryRun = process.argv.includes('--dry-run')

  if (!uid || uid.startsWith('--')) {
    console.error('❌ Thiếu UID. Cách chạy: npx tsx scripts/migrate-user-data.ts <UID> [--dry-run]')
    console.error('   Lấy UID: Firebase Console → Authentication → Users (cột User UID)')
    process.exit(1)
  }

  console.log(`🚀 Migration dữ liệu single-user → uid: ${uid}${dryRun ? ' (DRY RUN)' : ''}`)
  console.log(`   Project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}\n`)

  for (const name of COLLECTIONS) {
    const count = await migrateCollection(name, uid, dryRun)
    console.log(`  ${dryRun ? '🔍' : '✅'} ${name}: ${count} docs ${dryRun ? 'sẽ được gán' : 'đã gán'} user_id`)
  }

  const settingsResult = await migrateSettings(uid, dryRun)
  console.log(`  ${dryRun ? '🔍' : '✅'} settings/${uid}: ${settingsResult}`)

  console.log('\n✨ Migration hoàn tất!')
  if (dryRun) console.log('   (dry-run — chưa ghi gì; chạy lại không có --dry-run để áp dụng)')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Lỗi:', err.message)
  process.exit(1)
})
