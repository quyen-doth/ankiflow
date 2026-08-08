/**
 * Grants or revokes the `admin:true` custom claim for an AnkiFlow administrator.
 *
 * Firestore Security Rules cannot read `ADMIN_EMAIL`, so administrator access in
 * rules depends on the `admin:true` custom claim in the ID token. The signup route
 * grants the claim when the account email matches `ADMIN_EMAIL`; this script repairs
 * administrator accounts created before that behavior was introduced.
 *
 * Usage:
 *   npx tsx scripts/set-admin-claim.ts <email>           # grant administrator access
 *   npx tsx scripts/set-admin-claim.ts <email> --revoke  # revoke administrator access
 *
 * The administrator must sign out and sign back in before the refreshed token carries the claim.
 */

import { FIREBASE_ADMIN_ENV_NAMES, loadEnv } from './lib/load-env'
loadEnv({ required: FIREBASE_ADMIN_ENV_NAMES })

import { initializeApp, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
})

async function main() {
  const email = process.argv[2]
  const revoke = process.argv.includes('--revoke')

  if (!email || email.startsWith('--')) {
    console.error('❌ メールアドレスが必要です。使用方法: npx tsx scripts/set-admin-claim.ts <email> [--revoke]')
    process.exit(1)
  }

  const auth = getAuth(app)
  const user = await auth.getUserByEmail(email)
  await auth.setCustomUserClaims(user.uid, revoke ? { admin: null } : { admin: true })

  console.log(`✅ ${email} (uid: ${user.uid}) の管理者権限を${revoke ? '取り消しました' : '付与しました'}。`)
  console.log('   ⚠️  新しいカスタムクレームを反映するには、管理者がログアウトして再ログインする必要があります。')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ エラー:', err.message)
  process.exit(1)
})
