/**
 * Client-side auth helpers — Firebase Auth (email/password) + httpOnly session cookie.
 *
 * Flow:
 * - signIn: signInWithEmailAndPassword → lấy ID token → POST /api/auth/session
 *   (server tạo session cookie `__session`, httpOnly — JS không đọc được).
 * - signUp: POST /api/auth/signup (server tạo user qua Admin SDK — kiểm soát
 *   validation tập trung) → tự động signIn.
 * - logout: signOut Firebase client + DELETE /api/auth/session (revoke + xóa cookie)
 *   + clear localStorage (tránh user sau trên cùng máy thấy draft của user trước).
 *
 * Firebase client SDK vẫn đăng nhập song song (onAuthStateChanged) vì client
 * đọc Firestore trực tiếp — Security Rules (Phase D) dựa trên request.auth.
 */
import { z } from 'zod'
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

export const emailSchema = z.email('Please enter a valid email address')

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least 1 uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least 1 number')

export interface AuthResult {
  ok: boolean
  error?: string
}

/** Map Firebase Auth error codes sang thông điệp thân thiện (English — UI rule). */
function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password'
    case 'auth/too-many-requests':
      return 'Too many attempts — please try again later'
    case 'auth/network-request-failed':
      return 'Network error — please check your connection'
    default:
      return (err as Error)?.message || 'Something went wrong. Please try again.'
  }
}

/** Đăng nhập: Firebase client → đổi ID token lấy session cookie từ server. */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const idToken = await cred.user.getIdToken()

    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { ok: false, error: err.error || 'Failed to create session' }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: friendlyAuthError(err) }
  }
}

/** Đăng ký qua server (Admin SDK) rồi tự động đăng nhập. */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { ok: false, error: err.error || 'Sign up failed' }
    }
    return await signIn(email, password)
  } catch (err) {
    return { ok: false, error: friendlyAuthError(err) }
  }
}

/** Xóa mọi dữ liệu cục bộ của app (session form, pending entry/batch). */
export function clearLocalData(): void {
  if (typeof window === 'undefined') return
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('ankiflow_')) keys.push(key)
  }
  keys.forEach((key) => localStorage.removeItem(key))
}

/** Đăng xuất: revoke session cookie + signOut client + xóa local data. */
export async function logout(): Promise<void> {
  // DELETE trước khi signOut để server còn verify được cookie mà revoke refresh tokens.
  try {
    await fetch('/api/auth/session', { method: 'DELETE' })
  } catch {
    /* cookie sẽ hết hạn tự nhiên nếu request fail */
  }
  try {
    await firebaseSignOut(auth)
  } catch {
    /* client state sẽ được dọn khi reload */
  }
  clearLocalData()
}
