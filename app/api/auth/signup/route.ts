import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAdminAuthInstance } from '@/lib/firebase-admin'

/**
 * Đăng ký tài khoản qua Admin SDK (server-side) — validation tập trung bằng zod,
 * không dựa vào client. Rate limiting: dựa vào bảo vệ built-in của Firebase Auth
 * (in-memory counter vô dụng trên Vercel serverless — đã ghi trong plan).
 *
 * TODO (Phase C + M1 của firebase-auth-plan): sau khi data model per-user hoàn tất,
 * gọi seedUserDefaults(db, uid) tại đây để user mới nhận bộ master data default.
 * KHÔNG seed bây giờ — queries chưa filter theo user_id, seed sẽ tạo bản ghi
 * trùng lặp trong các collection dùng chung.
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
