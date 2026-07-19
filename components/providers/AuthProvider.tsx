'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export interface AuthUser {
  uid: string
  email: string | null
}

interface AuthContextValue {
  user: AuthUser | null
  /** Firebase の auth state 復元完了まで true — false を待ってから uid で query すること。 */
  loading: boolean
}

/** verify harness 用 export (runner が fixtures を test user で wrap) — production は AuthProvider を使用。 */
export const AuthContext = createContext<AuthContextValue>({ user: null, loading: true })

/**
 * Firebase Auth state の監視 (client SDK) — session cookie と並行して動く:
 * cookie は server/middleware を守り、client SDK のログインは components が直接 query する際に
 * Firestore Security Rules (Phase D) が request.auth を受け取るために必要。
 * ここでは redirect しない — route protection は middleware の責務。
 */
export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ? { uid: firebaseUser.uid, email: firebaseUser.email } : null)
      setLoading(false)
    })
  }, [])

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
