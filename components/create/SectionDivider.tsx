interface SectionDividerProps {
  label: string
}

export function SectionDivider({ label }: SectionDividerProps) {
  return (
    <div className="relative flex items-center gap-3 my-8">
      <div className="flex-1 border-t border-outline-var" />
      <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400">{label}</span>
      <div className="flex-1 border-t border-outline-var" />
    </div>
  )
}
