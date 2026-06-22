import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

interface ProgressBarProps {
  value: number
  label?: string
  showPercent?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function ProgressBar({ value, label, showPercent = false, size = 'md', className }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div
      className={cn('w-full', className)}
      {...verifyAttrs({ unit: 'ProgressBar', value: clampedValue })}
    >
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-overline uppercase tracking-[0.05em] text-slate-400 font-mono">{label}</span>}
          {showPercent && <span className="text-meta font-mono font-bold text-primary">{clampedValue}%</span>}
        </div>
      )}
      <div className={cn('bg-border rounded-pill overflow-hidden', size === 'md' ? 'h-2.5' : 'h-1.5')}>
        <div
          className="h-full bg-primary rounded-pill transition-all duration-500 ease-out"
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
