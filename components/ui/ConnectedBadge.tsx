'use client'

import { MonitorCheck } from 'lucide-react'

interface ConnectedBadgeProps {
  connected?: boolean
  label?: string
}

export function ConnectedBadge({ connected = true, label = 'Connected to Anki' }: ConnectedBadgeProps) {
  return (
    <div className="mx-2 mb-1 flex items-center gap-2 px-3 py-2.5 bg-surface-high rounded-lg">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-primary' : 'bg-outline'}`} />
      <MonitorCheck className="w-4 h-4 text-on-surface-var" />
      <span className="text-xs text-on-surface-var truncate">{label}</span>
    </div>
  )
}
