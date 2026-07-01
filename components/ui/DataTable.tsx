'use client'

import { useState } from 'react'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { arrayMove } from '@/lib/arrayMove'
import { verifyAttrs } from '@/verify/core/contract'

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
  /** Khi cung cấp, bật kéo-thả để đổi thứ tự. Nhận về mảng đã sắp xếp lại. */
  onReorder?: (reordered: T[]) => void
}

export function DataTable<T extends object>({
  data,
  columns,
  onRowClick,
  keyField,
  emptyMessage = 'No data',
  className,
  onReorder,
}: DataTableProps<T>) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const reorderable = !!onReorder && data.length > 1

  const handleDrop = () => {
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      onReorder?.(arrayMove(data, dragIndex, overIndex))
    }
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <div
      className={cn('w-full overflow-x-auto', className)}
      {...verifyAttrs({ unit: 'DataTable', rows: data.length, cols: columns.length })}
    >
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {reorderable && <th className="w-[36px] px-2 py-3" aria-hidden="true" />}
            {columns.map((col) => (
              <th
                key={String(col.key)}
                style={{ width: col.width }}
                className={cn(
                  'px-4 py-3 text-overline uppercase tracking-[0.05em] text-slate-400 font-mono font-bold',
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
              <td colSpan={columns.length + (reorderable ? 1 : 0)} className="text-center py-12 text-slate-400 text-sm">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={keyField ? String(row[keyField]) : i}
                draggable={reorderable}
                onDragStart={reorderable ? () => setDragIndex(i) : undefined}
                onDragOver={reorderable ? (e) => { e.preventDefault(); setOverIndex(i) } : undefined}
                onDragEnd={reorderable ? () => { setDragIndex(null); setOverIndex(null) } : undefined}
                onDrop={reorderable ? (e) => { e.preventDefault(); handleDrop() } : undefined}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'border-b border-border/60 transition-colors duration-100',
                  onRowClick && 'cursor-pointer hover:bg-surface',
                  dragIndex === i && 'opacity-50',
                  reorderable && overIndex === i && dragIndex !== i && 'border-t-2 border-t-primary'
                )}
              >
                {reorderable && (
                  <td className="w-[36px] px-2 py-3.5 text-center cursor-grab active:cursor-grabbing" onClick={(e) => e.stopPropagation()}>
                    <GripVertical className="w-4 h-4 text-slate-300 hover:text-slate-500 mx-auto" />
                  </td>
                )}
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={cn(
                      'px-4 py-3.5 text-body text-ink',
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
