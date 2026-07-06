'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/providers/AuthProvider'

/** Realtime số entry `reviewed` (chưa sync) CỦA USER hiện tại. 0 khi chưa đăng nhập. */
export function useUnsyncedCount() {
  const { user, loading } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (loading || !user) return
    const q = query(
      collection(db, 'entries'),
      where('user_id', '==', user.uid),
      where('status', '==', 'reviewed'),
    )
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => setCount(snapshot.size),
      () => setCount(0),
    )
    return unsubscribe
  }, [user, loading])

  // Derive thay vì setState sync trong effect: chưa đăng nhập → luôn 0
  return loading || !user ? 0 : count
}
