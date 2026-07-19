'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'

// Guard 対象外: 未ログインが正常な auth 画面と、dev-only の verify ダッシュボード。
const EXCLUDED_PREFIXES = ['/login', '/signup', '/verify']

interface AuthSessionGuardProps {
  /** テスト注入用 — 既定はサーバー session cookie の削除 (logout と同じ経路)。 */
  clearSession?: () => Promise<unknown>
  /** テスト注入用 — 既定はフルリロード付き遷移 (client 状態を完全に破棄するため)。 */
  redirect?: (path: string) => void
}

const defaultClearSession = () => fetch('/api/auth/session', { method: 'DELETE' })
const defaultRedirect = (path: string) => {
  window.location.href = path
}

/**
 * "split-brain" 検出 guard。middleware は `__session` cookie の存在しか確認しないため、
 * cookie が有効なまま client SDK だけ signed-out になると (profile の IndexedDB 削除・
 * refresh token の revoke 等)、全ページの Firestore 読み込みが無言で空になり、sidebar の
 * Sign out ボタンも消えて UI から脱出できない (middleware が /login を /dashboard へ
 * 跳ね返すため)。この状態を検出したら cookie を破棄して /login へ強制遷移する。
 */
export function AuthSessionGuard({
  clearSession = defaultClearSession,
  redirect = defaultRedirect,
}: AuthSessionGuardProps = {}) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const firedRef = useRef(false)

  const excluded = EXCLUDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname?.startsWith(prefix + '/'),
  )

  useEffect(() => {
    if (excluded || loading || user || firedRef.current) return
    firedRef.current = true
    void (async () => {
      try {
        await clearSession()
      } catch {
        /* cookie 削除に失敗しても遷移する — /login 側は middleware が処理する */
      }
      redirect('/login')
    })()
  }, [excluded, loading, user, clearSession, redirect])

  return null
}
