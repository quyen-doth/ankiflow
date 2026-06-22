'use client'

import { Sparkles } from 'lucide-react'
import { verifyAttrs } from '@/verify/core/contract'

interface SmartEnrichmentBannerProps {
  children: React.ReactNode
}

export function SmartEnrichmentBanner({ children }: SmartEnrichmentBannerProps) {
  return (
    <div
      className="bg-amber-bg/30 border border-amber-tint border-l-[4px] border-l-tertiary rounded-card p-5 flex items-start gap-4 mb-8"
      {...verifyAttrs({ unit: 'SmartEnrichmentBanner' })}
    >
      <div className="w-10 h-10 rounded-card bg-amber flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-sm font-bold text-amber mb-1">Smart Enrichment Active</p>
        <p className="text-sm text-slate-600 leading-relaxed">{children}</p>
      </div>
    </div>
  )
}
