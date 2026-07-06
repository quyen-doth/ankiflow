import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminAuthInstance, getAdminDb } from '@/lib/firebase-admin'
import { seedUserDefaults } from '@/lib/seed-defaults'

/**
 * Đăng ký tài khoản qua Admin SDK (server-side) — validation tập trung bằng zod,
 * không dựa vào client. Rate limiting: dựa vào bảo vệ built-in của Firebase Auth
 * (in-memory counter vô dụng trên Vercel serverless — đã ghi trong plan).
 * Sau khi tạo user → seed bộ master data default (decks/categories/card_types/
 * topics + settings prefs) cho workspace riêng của user.
 */
const signupSchema = z.object({
  email: z.email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least 1 number'),
})

export async function POST(request: Request) {
  try {
    const parsed = signupSchema.safeParse(await request.json())
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Invalid email or password format'
      return NextResponse.json({ error: message }, { status: 400 })
    }
    const { email, password } = parsed.data

    const adminAuth = getAdminAuthInstance()
    const user = await adminAuth.createUser({ email, password })

    // Nếu là email admin (env ADMIN_EMAIL) → đặt custom claim admin:true để Firestore
    // Security Rules nhận diện admin (rules không đọc được env). Client signIn NGAY SAU
    // đây sẽ mint ID token mang claim, nên admin không phải re-login khi tự signup.
    if (process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL) {
      try {
        await adminAuth.setCustomUserClaims(user.uid, { admin: true })
      } catch (e) {
        console.error('Failed to set admin claim for', email, e)
      }
    }

    // Seed master data default cho user mới. Best-effort: seed lỗi không chặn
    // signup (account đã tạo) — user save settings/tạo deck sau vẫn hoạt động.
    try {
      await seedUserDefaults(getAdminDb(), user.uid)
    } catch (e) {
      console.error('Seed defaults failed for new user', user.uid, e)
    }

    return NextResponse.json({ success: true, uid: user.uid })
  } catch (error) {
    const code = (error as { code?: string })?.code || ''
    if (code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }
    if (code === 'auth/invalid-email') {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Sign up failed. Please try again.' }, { status: 500 })
  }
}
