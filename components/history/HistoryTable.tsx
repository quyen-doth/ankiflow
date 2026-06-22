'use client'

import { useRouter } from 'next/navigation'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Eye, Pencil, Trash2 } from 'lucide-react'
import { verifyAttrs } from '@/verify/core/contract'
import type { Entry } from '@/types'

interface HistoryTableProps {
  data: Entry[]
  onEdit?: (entry: Entry) => void
  onDelete?: (id: string) => void
}

export function HistoryTable({ data, onEdit, onDelete }: HistoryTableProps) {
  const router = useRouter()

  function truncateDeck(deck: string | undefined): string {
    if (!deck) return '—'
    if (deck.length <= 20) return deck
    return '…' + deck.slice(-17)
  }

  function formatDate(row: Entry): string {
    if (!row.created_at) return '—'
    const date = row.created_at.toDate ? row.created_at.toDate() : new Date((row.created_at as { seconds: number }).seconds * 1000)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function langCode(row: Entry): string | null {
    if (row.form_type !== 'form_language' || !row.language) return null
    const map: Record<string, string> = { en: 'EN', ja: 'JA', zh: 'ZH' }
    return map[row.language] || row.language.toUpperCase().slice(0, 2)
  }

  const columns = [
    {
      key: 'word',
      header: 'Word',
      render: (_: unknown, row: Entry) => (
        <span className="font-bold text-lg text-ink">
          {row.word || row.term || row.title || '—'}
        </span>
      ),
    },
    {
      key: 'meaning',
      header: 'Meaning',
      render: (_: unknown, row: Entry) => (
        <span className="text-slate-600">
          {row.meaning_vi || row.definition || row.content || '—'}
        </span>
      ),
    },
    {
      key: 'language',
      header: 'Lang',
      render: (_: unknown, row: Entry) => {
        const code = langCode(row)
        if (!code) return <span className="text-slate-400">—</span>
        const isJa = code === 'JA'
        return (
          <Badge className={`px-2.5 py-1 text-[11px] ${isJa ? 'bg-amber-bg text-amber-dark' : 'bg-primary-bg text-primary'}`}>
            {code}
          </Badge>
        )
      },
    },
    {
      key: 'anki_deck',
      header: 'Deck',
      render: (_: unknown, row: Entry) => (
        <span className="text-ink font-medium text-[13px] font-mono">
          {truncateDeck(row.anki_deck)}
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
            ? 'bg-primary-bg text-primary'
            : 'bg-amber-bg text-amber-dark'
          }>
            <span className={`inline-block w-[6px] h-[6px] rounded-full mr-1.5 ${isSynced ? 'bg-primary' : 'bg-amber'}`} />
            {isSynced ? 'Synced' : 'Pending'}
          </Badge>
        )
      },
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (_: unknown, row: Entry) => (
        <span className="text-slate-600 text-sm">{formatDate(row)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right' as const,
      render: (_: unknown, row: Entry) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              onEdit?.(row)
            }}
            className="p-2 h-auto text-slate-600 hover:text-primary hover:bg-primary-bg rounded-full"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              router.push(`/history/${row.id}`)
            }}
            className="p-2 h-auto text-slate-600 hover:text-primary hover:bg-primary-bg rounded-full"
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
            className="p-2 h-auto text-slate-600 hover:text-danger hover:bg-danger-bg rounded-full"
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
      className="bg-white rounded-card border border-border/40 overflow-hidden"
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
