import { cn } from '@/lib/utils'

type BadgeVariant = 'neutral' | 'active' | 'inactive' | 'pending' | 'ai' | 'language' | 'level'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
  onRemove?: () => void  // nếu có → hiển thị nút ×
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral:  'bg-surface-high text-on-surface-var',
  active:   'bg-primary/10 text-primary',
  inactive: 'bg-error-container text-on-error',
  pending:  'bg-tertiary-fixed text-on-tertiary-fixed',
  ai:       'bg-tertiary-fixed text-on-tertiary-fixed',
  language: 'bg-primary/10 text-primary',
  level:    'bg-surface-high text-on-surface-var border border-outline-var/40',
}

export function Badge({ variant = 'neutral', children, className, onRemove }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5',
      'text-label-sm uppercase tracking-wide font-semibold',
      variantClasses[variant],
      className
    )}>
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 hover:opacity-70 transition-opacity leading-none"
          aria-label="Remove"
        >
          ×
        </button>
      )}
    </span>
  )
}
