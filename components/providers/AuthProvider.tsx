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
  /** true cho đến khi Firebase khôi phục xong auth state — đợi false rồi mới query theo uid. */
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true })

/**
 * Theo dõi Firebase Auth state (client SDK) — chạy song song với session cookie:
 * cookie bảo vệ server/middleware, còn client SDK cần đăng nhập để Firestore
 * Security Rules (Phase D) nhận request.auth khi components query trực tiếp.
 * KHÔNG tự redirect ở đây — route protection là việc của middleware.
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
