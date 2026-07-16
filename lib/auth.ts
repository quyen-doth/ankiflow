/**
 * Client-side auth helpers — Firebase Auth (email/password) + httpOnly session cookie。
 *
 * Flow:
 * - signIn: signInWithEmailAndPassword → ID token を取得 → POST /api/auth/session
 *   (サーバーが session cookie `__session` を作成、httpOnly — JS からは読めない)。
 * - signUp: POST /api/auth/signup (サーバーが Admin SDK 経由でユーザー作成 —
 *   validation を一元管理) → 自動的に signIn。
 * - logout: Firebase client の signOut + DELETE /api/auth/session (revoke + クッキー削除)
 *   + localStorage をクリア (同じマシンの次のユーザーが前のユーザーの draft を見るのを防ぐ)。
 *
 * Firebase client SDK は並行してログイン状態を保持 (onAuthStateChanged) — クライアントが
 * Firestore を直接読むため、Security Rules (Phase D) は request.auth に基づく。
 */
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

export { emailSchema, passwordSchema } from '@/lib/auth-validation'

export interface AuthResult {
  ok: boolean
  error?: string
}

/** Firebase Auth error codes をフレンドリーなメッセージにマップ (English — UI rule)。 */
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

/** ログイン: Firebase client → ID token をサーバーの session cookie と交換。 */
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

/** サーバー (Admin SDK) 経由でサインアップした後、自動的にログイン。 */
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

/** アプリのローカルデータをすべて削除 (session form、pending entry/batch)。 */
export function clearLocalData(): void {
  if (typeof window === 'undefined') return
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('ankiflow_')) keys.push(key)
  }
  keys.forEach((key) => localStorage.removeItem(key))
}

/** ログアウト: session cookie を revoke + client の signOut + local data 削除。 */
export async function logout(): Promise<void> {
  // signOut の前に DELETE することで、サーバーがまだクッキーを検証できる状態で refresh tokens を revoke できる。
  try {
    await fetch('/api/auth/session', { method: 'DELETE' })
  } catch {
    /* リクエストが失敗してもクッキーは自然に期限切れになる */
  }
  try {
    await firebaseSignOut(auth)
  } catch {
    /* client state はリロード時にクリアされる */
  }
  clearLocalData()
}
