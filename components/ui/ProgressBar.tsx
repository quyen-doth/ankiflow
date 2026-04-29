import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number           // 0–100
  label?: string
  showPercent?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function ProgressBar({ value, label, showPercent = false, size = 'md', className }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className={cn('w-full', className)}>
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-label-sm uppercase tracking-wide text-on-surface-var">{label}</span>}
          {showPercent && <span className="text-xs font-semibold text-primary">{clampedValue}%</span>}
        </div>
      )}
      <div className={cn('bg-surface-high rounded-full overflow-hidden', size === 'md' ? 'h-2.5' : 'h-1.5')}>
        <div
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${clampedValue}%` }}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
