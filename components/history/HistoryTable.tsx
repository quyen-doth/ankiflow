'use client'

import { useRouter } from 'next/navigation'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Eye, Trash2 } from 'lucide-react'
import { verifyAttrs } from '@/verify/core/contract'
import type { Entry } from '@/types'

interface HistoryTableProps {
  data: Entry[]
  onDelete?: (id: string) => void
}

export function HistoryTable({ data, onDelete }: HistoryTableProps) {
  const router = useRouter()

  const columns = [
    {
      key: 'word',
      header: 'Word',
      render: (_: unknown, row: Entry) => (
        <span className="font-serif font-bold text-lg text-on-surface">
          {row.word || row.term || row.title || '—'}
        </span>
      ),
    },
    {
      key: 'meaning',
      header: 'Meaning',
      render: (_: unknown, row: Entry) => (
        <span className="text-on-surface-var">
          {row.meaning_vi || row.definition || row.content || '—'}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Category',
      render: (_: unknown, row: Entry) => {
        let label = 'General'
        if (row.form_type === 'form_language') label = row.language || 'Language'
        if (row.form_type === 'form_it') label = 'IT & Dev'
        return (
          <Badge className="bg-surface-high text-on-surface-var font-medium px-3 py-1">
            {label}
          </Badge>
        )
      },
    },
    {
      key: 'anki_deck',
      header: 'Deck',
      render: (_: unknown, row: Entry) => (
        <span className="text-on-surface font-medium">
          {row.anki_deck || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (_: unknown, row: Entry) => {
        const isSynced = row.status === 'synced'
        return (
          <Badge className={isSynced
            ? 'bg-primary/10 text-primary'
            : 'bg-tertiary-fixed text-on-tertiary-fixed'
          }>
            {isSynced ? 'Synced' : 'Pending sync'}
          </Badge>
        )
      },
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (_: unknown, row: Entry) => {
        if (!row.created_at) return '—'
        const date = row.created_at.toDate ? row.created_at.toDate() : new Date((row.created_at as { seconds: number }).seconds * 1000)
        return <span className="text-on-surface-var text-sm">{date.toLocaleDateString('en-US')}</span>
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (_: unknown, row: Entry) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/history/${row.id}`)
            }}
            className="p-2 h-auto text-on-surface-var hover:text-primary hover:bg-primary/10 rounded-full"
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.(row.id as string)
            }}
            className="p-2 h-auto text-on-surface-var hover:text-error hover:bg-error-container rounded-full"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div
      className="bg-white rounded-xl shadow-card border border-outline-var/40 overflow-hidden"
      {...verifyAttrs({ unit: 'HistoryTable', rows: data.length })}
    >
      <DataTable
        data={data}
        columns={columns}
        keyField="id"
        onRowClick={(row) => router.push(`/history/${row.id}`)}
        emptyMessage="No vocabulary cards created yet."
      />
    </div>
  )
}
