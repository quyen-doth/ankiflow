'use client'

import { useState, useEffect } from 'react'
import { verifyAttrs } from '@/verify/core/contract'

interface ConnectedBadgeProps {
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
    <div
      className={`flex items-center gap-2 px-2.5 py-2 rounded-[8px] border ${
        connected ? 'border-primary-tint bg-primary-bg' : 'border-border bg-canvas'
      }`}
      {...verifyAttrs({ unit: 'ConnectedBadge', connected })}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${connected ? 'bg-primary' : 'bg-slate-400'}`}
        style={connected ? { boxShadow: '0 0 0 3px rgba(49,99,66,.14)' } : undefined}
      />
      <span className={`text-[11px] font-semibold ${connected ? 'text-primary' : 'text-slate-400'}`}>
        {connected ? 'Anki connected' : 'Anki offline'}
      </span>
      {connected && (
        <span className="ml-auto text-[9.5px] font-mono text-[#7fa48c]">:8765</span>
      )}
    </div>
  )
}
