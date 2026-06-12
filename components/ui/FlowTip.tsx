import { Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

interface FlowTipProps {
  children: React.ReactNode
  label?: string  // default: "Flow Tip"
  className?: string
}

export function FlowTip({ children, label = 'Flow Tip', className }: FlowTipProps) {
  return (
    <div
      className={cn(
        'bg-tertiary-fixed/30 border border-tertiary-fixed/60 rounded-lg p-4',
        'flex items-start gap-3',
        className
      )}
      {...verifyAttrs({ unit: 'FlowTip', label })}
    >
      <div className="w-7 h-7 rounded-full bg-tertiary-fixed flex items-center justify-center flex-shrink-0 mt-0.5">
        <Lightbulb className="w-3.5 h-3.5 text-tertiary" />
      </div>
      <div>
        <p className="text-label-sm uppercase tracking-wide text-tertiary mb-1">{label}</p>
        <p className="text-body-md text-on-surface">{children}</p>
      </div>
    </div>
  )
}
