import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

interface StatCardProps {
  label: string
  value: string | number
  delta?: string
  icon?: React.ReactNode
  className?: string
}

export function StatCard({ label, value, delta, icon, className }: StatCardProps) {
  return (
    <div
      className={cn('bg-white rounded-card border border-border p-6', className)}
      {...verifyAttrs({ unit: 'StatCard', value })}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <p className="text-overline uppercase tracking-[0.05em] text-slate-400 font-mono">{label}</p>
        {icon && <span className="text-slate-400 flex-shrink-0">{icon}</span>}
      </div>
      <p className="text-page-title font-extrabold text-ink">{value}</p>
      {delta && <p className="text-meta font-mono text-slate-400 mt-1">{delta}</p>}
    </div>
  )
}
