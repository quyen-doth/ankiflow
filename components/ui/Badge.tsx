import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

type BadgeVariant = 'neutral' | 'active' | 'inactive' | 'pending' | 'ai' | 'language' | 'level'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
  onRemove?: () => void
}

const variantStyles: Record<BadgeVariant, string> = {
  neutral:  'bg-canvas text-slate-600',
  active:   'bg-primary-bg text-primary',
  inactive: 'bg-danger-bg text-danger',
  pending:  'bg-amber-bg text-amber-dark',
  ai:       'bg-amber-bg text-amber-dark',
  language: 'bg-primary-bg text-primary font-mono',
  level:    'bg-canvas text-slate-600 border border-border',
}

export function Badge({ variant = 'neutral', children, className, onRemove }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5',
        'text-[11.5px] font-semibold',
        variantStyles[variant],
        className
      )}
      {...verifyAttrs({ unit: 'Badge', variant, removable: !!onRemove })}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="hover:opacity-70 transition-opacity flex items-center justify-center"
          aria-label="Remove"
        >
          <span className="text-lg leading-none mb-[2px]">&times;</span>
        </button>
      )}
    </span>
  )
}
