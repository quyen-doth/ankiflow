/**
 * scripts/set-admin-claim.ts — đặt custom claim `admin:true` cho tài khoản admin.
 *
 * Vì Firestore Security Rules KHÔNG đọc được env (ADMIN_EMAIL), quyền admin trong
 * rules dựa vào custom claim `admin:true` trong ID token. Signup route tự đặt claim
 * cho account có email == ADMIN_EMAIL; script này dùng cho account admin ĐÃ TẠO
 * TRƯỚC khi có tính năng (chạy 1 lần).
 *
 * Cách chạy:
 *   npx tsx scripts/set-admin-claim.ts <email>          # đặt admin
 *   npx tsx scripts/set-admin-claim.ts <email> --revoke  # gỡ admin
 *
 * ⚠️ SAU KHI CHẠY: admin phải ĐĂNG XUẤT + ĐĂNG NHẬP LẠI để ID token mới mang claim.
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env' })

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
    console.error('❌ Thiếu email. Cách chạy: npx tsx scripts/set-admin-claim.ts <email> [--revoke]')
    process.exit(1)
  }

  const auth = getAuth(app)
  const user = await auth.getUserByEmail(email)
  await auth.setCustomUserClaims(user.uid, revoke ? { admin: null } : { admin: true })

  console.log(`✅ ${revoke ? 'Đã gỡ' : 'Đã đặt'} admin:${revoke ? 'null' : 'true'} cho ${email} (uid: ${user.uid})`)
  console.log('   ⚠️  Admin PHẢI đăng xuất + đăng nhập lại để token mới có hiệu lực.')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Lỗi:', err.message)
  process.exit(1)
})
