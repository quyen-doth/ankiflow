import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}
      {...verifyAttrs({ unit: 'EmptyState', hasAction: !!action })}
    >
      {icon && (
        <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-slate-400 mb-4">
          {icon}
        </div>
      )}
      <p className="text-body font-semibold text-ink">{title}</p>
      {description && <p className="text-sm text-slate-600 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
