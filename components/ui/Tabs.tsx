'use client'

import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

interface Tab {
  id: string
  label: string
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (id: string) => void
  className?: string
  variant?: 'pill' | 'underline'
}

export function Tabs({ tabs, activeTab, onChange, className, variant = 'pill' }: TabsProps) {
  if (variant === 'underline') {
    return (
      <div
        className={cn('flex gap-6 border-b border-border', className)}
        role="tablist"
        {...verifyAttrs({ unit: 'Tabs', count: tabs.length, active: activeTab })}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'whitespace-nowrap text-[14px] py-2.5 -mb-px transition-colors',
              'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-bg',
              activeTab === tab.id
                ? 'text-ink font-bold border-b-2 border-primary'
                : 'text-slate-400 hover:text-ink'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn('flex flex-wrap gap-1 bg-canvas rounded-[9px] p-1', className)}
      role="tablist"
      {...verifyAttrs({ unit: 'Tabs', count: tabs.length, active: activeTab })}
    >
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex-1 whitespace-nowrap text-[11.5px] font-bold py-1.5 px-3 rounded-[7px] transition-colors',
            'focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-bg',
            activeTab === tab.id
              ? 'bg-white text-primary border border-border'
              : 'text-slate-600 hover:text-ink'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
