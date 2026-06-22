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
      className="flex items-center gap-2.5 px-3 py-2.5 bg-canvas rounded-[8px]"
      {...verifyAttrs({ unit: 'ConnectedBadge', connected })}
    >
      <span className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${connected ? 'bg-primary' : 'bg-slate-400'}`}
        style={connected ? { boxShadow: '0 0 0 3px rgba(49,99,66,.14)' } : undefined}
      />
      <span className={`text-[13px] font-medium ${connected ? 'text-ink' : 'text-slate-400'}`}>
        {connected ? 'Anki connected' : 'Anki offline'}
      </span>
      {connected && (
        <span className="ml-auto text-[12.5px] font-mono text-slate-400">:8765</span>
      )}
    </div>
  )
}
