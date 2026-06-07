'use client'

import { cn } from '@/lib/utils'

interface Tab {
  id: string
  label: string
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div className={cn('flex flex-wrap gap-1 bg-surface-low rounded-lg p-1', className)} role="tablist">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex-1 whitespace-nowrap text-label-sm font-bold py-1.5 px-3 rounded-md transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            activeTab === tab.id
              ? 'bg-white text-primary shadow-card'
              : 'text-on-surface-var hover:text-on-surface'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
