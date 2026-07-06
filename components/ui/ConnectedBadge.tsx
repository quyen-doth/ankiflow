'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { getAnkiClientFromSettings } from '@/lib/flashcard-service/client'
import { verifyAttrs } from '@/verify/core/contract'

interface ConnectedBadgeProps {
  connected?: boolean
  unsyncedCount?: number
  onSync?: () => void
  isSyncing?: boolean
  syncResult?: string | null
}

export function ConnectedBadge({ connected: propConnected, unsyncedCount = 0, onSync, isSyncing = false, syncResult }: ConnectedBadgeProps) {
  const [polledConnected, setPolledConnected] = useState(false)
  const connected = propConnected !== undefined ? propConnected : polledConnected

  useEffect(() => {
    if (propConnected !== undefined) return

    async function checkAnki() {
      try {
        const client = await getAnkiClientFromSettings()
        const { connected: isConnected } = await client.ping()
        setPolledConnected(isConnected)
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
      className={`flex flex-col gap-1.5 px-2.5 py-2 rounded-[8px] border ${
        connected ? 'border-primary-tint bg-primary-bg' : 'border-border bg-canvas'
      }`}
      {...verifyAttrs({ unit: 'ConnectedBadge', connected })}
    >
      <div className="flex items-center gap-2">
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

      {unsyncedCount > 0 && connected && onSync && (
        <button
          type="button"
          onClick={onSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-dark hover:text-amber transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : `Sync ${unsyncedCount} card${unsyncedCount > 1 ? 's' : ''}`}
        </button>
      )}

      {unsyncedCount > 0 && !connected && (
        <span className="text-[10.5px] text-slate-400">
          {unsyncedCount} card{unsyncedCount > 1 ? 's' : ''} pending sync
        </span>
      )}

      {syncResult && (
        <span className="text-[10.5px] text-slate-400">{syncResult}</span>
      )}
    </div>
  )
}
