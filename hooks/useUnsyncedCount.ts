'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export function useUnsyncedCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const q = query(collection(db, 'entries'), where('status', '==', 'reviewed'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => setCount(snapshot.size),
      () => setCount(0),
    )
    return unsubscribe
  }, [])

  return count
}
