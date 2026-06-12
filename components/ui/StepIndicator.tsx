import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

type StepStatus = 'completed' | 'active' | 'pending'

interface Step {
  label: string
  description?: string
  status: StepStatus
}

interface StepIndicatorProps {
  steps: Step[]
  className?: string
}

export function StepIndicator({ steps, className }: StepIndicatorProps) {
  return (
    <div
      className={cn('flex flex-col gap-3', className)}
      {...verifyAttrs({
        unit: 'StepIndicator',
        count: steps.length,
        completed: steps.filter(s => s.status === 'completed').length,
      })}
    >
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
            step.status === 'completed' && 'bg-primary text-white',
            step.status === 'active' && 'bg-surface-high text-primary border-2 border-primary',
            step.status === 'pending' && 'bg-surface-high text-on-surface-var/40',
          )}>
            {step.status === 'completed' ? (
              <Check className="w-4 h-4" />
            ) : (
              <span className="text-label-sm font-bold">{i + 1}</span>
            )}
          </div>

          {/* Label */}
          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-sm font-semibold',
              step.status === 'pending' ? 'text-on-surface-var/50' : 'text-on-surface'
            )}>
              {step.label}
            </p>
            {step.description && (
              <p className={cn(
                'text-label-sm mt-0.5',
                step.status === 'active' ? 'text-on-surface-var italic' : 'text-on-surface-var/50'
              )}>
                {step.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
