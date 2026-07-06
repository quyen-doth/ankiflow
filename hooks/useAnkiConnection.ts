'use client'

import { useState, useEffect } from 'react'
import { getAnkiClientFromSettings } from '@/lib/flashcard-service/client'

/**
 * Trạng thái kết nối Anki — ping AnkiConnect trực tiếp từ browser
 * (máy của chính user), không đi qua API route server.
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
