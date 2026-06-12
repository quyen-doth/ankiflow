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
      className={cn('bg-white rounded-xl shadow-card border border-outline-var/40 p-6', className)}
      {...verifyAttrs({ unit: 'StatCard', value })}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <p className="text-label-sm uppercase tracking-wide text-on-surface-var">{label}</p>
        {icon && <span className="text-on-surface-var flex-shrink-0">{icon}</span>}
      </div>
      <p className="text-display font-serif text-on-surface">{value}</p>
      {delta && <p className="text-label-sm text-on-surface-var mt-1">{delta}</p>}
    </div>
  )
}
