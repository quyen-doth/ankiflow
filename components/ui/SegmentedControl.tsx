'use client'

import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  'aria-label'?: string
  className?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  ...rest
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={rest['aria-label']}
      className={cn('inline-flex flex-wrap gap-1 p-1 bg-[#F0F0EC] rounded-[10px]', className)}
      {...verifyAttrs({ unit: 'SegmentedControl', value })}
    >
      {options.map(opt => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-3 py-1.5 rounded-[7px] text-[13px] font-medium transition-colors duration-150 cursor-pointer',
              isActive
                ? 'bg-white text-ink shadow-sm font-bold'
                : 'text-slate-500 hover:text-ink',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
