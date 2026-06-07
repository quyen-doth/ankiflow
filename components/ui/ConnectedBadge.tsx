'use client'

import { useState, useEffect } from 'react'
import { MonitorCheck, MonitorX } from 'lucide-react'

interface ConnectedBadgeProps {
  /** Override the connection status — if omitted, polls Anki every 30s */
  connected?: boolean
}

export function ConnectedBadge({ connected: propConnected }: ConnectedBadgeProps) {
  const [polledConnected, setPolledConnected] = useState(false)
  const connected = propConnected !== undefined ? propConnected : polledConnected

  useEffect(() => {
    if (propConnected !== undefined) return

    async function checkAnki() {
      try {
        const res = await fetch('/api/anki/connect', { cache: 'no-store' })
        setPolledConnected(res.ok)
      } catch {
        setPolledConnected(false)
      }
    }

    checkAnki()
    const interval = setInterval(checkAnki, 30_000)
    return () => clearInterval(interval)
  }, [propConnected])

  return (
    <div className="mx-1 mb-1 flex items-center gap-2.5 px-3 py-2.5 bg-surface-high rounded-lg">
      {/* Status dot */}
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? 'bg-primary' : 'bg-outline'}`} />

      {/* Icon */}
      {connected
        ? <MonitorCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        : <MonitorX className="w-3.5 h-3.5 text-on-surface-var flex-shrink-0" />
      }

      <span className="text-label-sm font-semibold tracking-wide uppercase text-on-surface-var truncate">
        {connected ? 'Connected to Anki' : 'Anki offline'}
      </span>
    </div>
  )
}
