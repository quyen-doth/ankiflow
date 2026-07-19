'use client'

import { useState, useEffect } from 'react'
import { getAnkiClientFromSettings } from '@/lib/flashcard-service/client'

/**
 * Anki 接続状態 — browser から AnkiConnect を直接 ping する
 * (user 自身のマシン)。server の API route は経由しない。
 */
export function useAnkiConnection(pollInterval = 30_000) {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    let active = true

    async function check() {
      try {
        const client = await getAnkiClientFromSettings()
        const { connected: isConnected } = await client.ping()
        if (active) setConnected(isConnected)
      } catch {
        if (active) setConnected(false)
      }
    }

    check()
    const interval = setInterval(check, pollInterval)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [pollInterval])

  return connected
}
