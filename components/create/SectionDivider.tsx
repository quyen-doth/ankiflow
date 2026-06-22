import { verifyAttrs } from '@/verify/core/contract'

interface SectionDividerProps {
  label: string
}

export function SectionDivider({ label }: SectionDividerProps) {
  return (
    <div className="relative flex items-center gap-3 my-8" {...verifyAttrs({ unit: 'SectionDivider' })}>
      <div className="flex-1 border-t border-border" />
      <span className="text-overline uppercase tracking-[0.2em] font-bold text-slate-600/60">{label}</span>
      <div className="flex-1 border-t border-border" />
    </div>
  )
}
