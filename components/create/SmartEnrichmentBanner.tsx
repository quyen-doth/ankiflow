'use client'

import { Sparkles } from 'lucide-react'

interface SmartEnrichmentBannerProps {
  children: React.ReactNode
}

export function SmartEnrichmentBanner({ children }: SmartEnrichmentBannerProps) {
  return (
    <div className="bg-tertiary-fixed/30 border border-tertiary-fixed border-l-[4px] border-l-tertiary rounded-xl p-5 flex items-start gap-4 mb-8">
      <div className="w-10 h-10 rounded-xl bg-tertiary flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm font-bold text-tertiary mb-1">Smart Enrichment Active</p>
        <p className="text-sm text-on-surface-var leading-relaxed">{children}</p>
      </div>
    </div>
  )
}
