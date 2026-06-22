import { Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

interface FlowTipProps {
  children: React.ReactNode
  label?: string
  className?: string
}

export function FlowTip({ children, label = 'Flow Tip', className }: FlowTipProps) {
  return (
    <div
      className={cn(
        'bg-amber-bg border border-amber-tint rounded-[9px] p-4',
        'flex items-start gap-3',
        className
      )}
      {...verifyAttrs({ unit: 'FlowTip', label })}
    >
      <div className="w-7 h-7 rounded-[7px] bg-amber-tint flex items-center justify-center flex-shrink-0 mt-0.5">
        <Lightbulb className="w-3.5 h-3.5 text-amber" />
      </div>
      <div>
        <p className="text-overline uppercase tracking-[0.05em] text-amber-dark font-mono mb-1">{label}</p>
        <p className="text-body text-ink">{children}</p>
      </div>
    </div>
  )
}
