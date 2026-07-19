'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/providers/AuthProvider'

/** 現在の USER の `reviewed` (未 sync) entry 数を realtime 取得。未ログイン時は 0。 */
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

  // effect 内の同期 setState ではなく derive: 未ログイン → 常に 0
  return loading || !user ? 0 : count
}
