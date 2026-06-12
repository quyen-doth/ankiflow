interface ColumnLabelProps {
  label: string
}

/** Tiêu đề cột nhẹ — thay cho SectionDivider trong layout 2 cột để tiết kiệm chiều cao */
export function ColumnLabel({ label }: ColumnLabelProps) {
  return (
    <h3 className="text-label-lg uppercase tracking-[0.15em] font-bold text-on-surface-var/60 mb-4">
      {label}
    </h3>
  )
}
