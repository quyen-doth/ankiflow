import { NextResponse } from 'next/server'
import { provisionUserAccount } from '@/lib/account-provisioning'
import { signupSchema } from '@/lib/auth-validation'
import { isPublicSignupEnabled } from '@/lib/signup-policy'

/**
 * Đăng ký tài khoản qua Admin SDK (server-side) — validation tập trung bằng zod,
 * không dựa vào client. Rate limiting: dựa vào bảo vệ built-in của Firebase Auth
 * (in-memory counter vô dụng trên Vercel serverless — đã ghi trong plan).
 * Sau khi tạo user → seed bộ master data default (decks/categories/card_types/
 * topics + settings prefs) cho workspace riêng của user.
 */
export async function POST(request: Request) {
  if (!isPublicSignupEnabled()) {
    return NextResponse.json({ error: 'Sign-ups are currently closed' }, { status: 403 })
  }

  try {
    const parsed = signupSchema.safeParse(await request.json())
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Invalid email or password format'
      return NextResponse.json({ error: message }, { status: 400 })
    }
    const { email, password } = parsed.data

    const result = await provisionUserAccount({ email, password })
    for (const warning of result.warnings) {
      if (warning.step === 'admin-claim') {
        console.error('Failed to set admin claim for', email, warning.error)
      } else {
        console.error('Seed defaults failed for new user', result.uid, warning.error)
      }
    }

    return NextResponse.json({ success: true, uid: result.uid })
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
