interface ColumnLabelProps {
  label: string
}

/** Tiêu đề cột nhẹ — thay cho SectionDivider trong layout 2 cột để tiết kiệm chiều cao */
export function ColumnLabel({ label }: ColumnLabelProps) {
  return (
    <h3 className="text-body font-bold uppercase tracking-[0.15em] font-bold text-slate-600/60 mb-4">
      {label}
    </h3>
  )
}
