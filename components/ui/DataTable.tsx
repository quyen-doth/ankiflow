'use client'

import { cn } from '@/lib/utils'

interface Column<T> {
  key: keyof T | string
  header: string
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (value: unknown, row: T) => React.ReactNode
}

interface DataTableProps<T extends object> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (row: T) => void
  keyField?: keyof T
  emptyMessage?: string
  className?: string
}

export function DataTable<T extends object>({
  data,
  columns,
  onRowClick,
  keyField,
  emptyMessage = 'No data',
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-outline-var/50">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                style={{ width: col.width }}
                className={cn(
                  'px-4 py-3 text-label-sm uppercase tracking-wide text-on-surface-var font-semibold',
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-12 text-on-surface-var text-sm">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={keyField ? String(row[keyField]) : i}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'border-b border-outline-var/30 transition-colors duration-100',
                  onRowClick && 'cursor-pointer hover:bg-surface-container/50'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={cn(
                      'px-4 py-3.5 text-body-md text-on-surface',
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    )}
                  >
                    {col.render
                      ? col.render(row[col.key as keyof T], row)
                      : String(row[col.key as keyof T] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
