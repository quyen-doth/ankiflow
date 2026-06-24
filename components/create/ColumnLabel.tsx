import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ColumnLabelProps {
  label: string
  icon?: LucideIcon
  tone?: 'green' | 'amber'
}

const TONE_STYLES = {
  green: { box: 'bg-[rgba(49,99,66,0.1)]', icon: 'text-primary' },
  amber: { box: 'bg-[rgba(184,117,20,0.1)]', icon: 'text-[#b87514]' },
} as const

/** Section header for the two-column create form: tinted icon square + mono overline. */
export function ColumnLabel({ label, icon: Icon, tone = 'green' }: ColumnLabelProps) {
  const t = TONE_STYLES[tone]
  return (
    <div className="flex items-center gap-2 mb-5">
      {Icon && (
        <span className={cn('w-[26px] h-[26px] rounded-[7px] flex items-center justify-center flex-shrink-0', t.box)}>
          <Icon className={cn('w-[15px] h-[15px]', t.icon)} />
        </span>
      )}
      <span className="text-[12px] font-bold tracking-[0.05em] uppercase font-mono text-slate-600">
        {label}
      </span>
    </div>
  )
}
