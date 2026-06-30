'use client'

import { useState, useEffect } from 'react'

export function useAnkiConnection(pollInterval = 30_000) {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/api/anki/connect', { cache: 'no-store' })
        setConnected(res.ok)
      } catch {
        setConnected(false)
      }
    }

    check()
    const interval = setInterval(check, pollInterval)
    return () => clearInterval(interval)
  }, [pollInterval])

  return connected
}
