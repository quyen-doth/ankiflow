'use client'

import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Pencil, Trash2 } from 'lucide-react'
import { verifyAttrs } from '@/verify/core/contract'
import { useStudyLanguages } from '@/components/providers/StudyLanguageProvider'
import { languageDisplayName, primaryLanguageSubtag } from '@/lib/studyLanguages'
import { FormType, type Entry } from '@/types'

interface HistoryTableProps {
  data: Entry[]
  selectedIds: ReadonlySet<string>
  onToggleSelect: (id: string) => void
  onToggleSelectAll: () => void
  onOpen?: (entry: Entry) => void
  onEdit?: (entry: Entry) => void
  onDelete?: (id: string) => void
}

export function HistoryTable({
  data,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onOpen,
  onEdit,
  onDelete,
}: HistoryTableProps) {
  const { languages } = useStudyLanguages()

  const selectableIds = data.flatMap(entry => (
    typeof entry.id === 'string' && entry.id ? [entry.id] : []
  ))
  const allSelected = selectableIds.length > 0
    && selectableIds.every(id => selectedIds.has(id))
  const someSelected = selectableIds.some(id => selectedIds.has(id))

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
    if (row.form_type !== FormType.LANGUAGE || !row.language) return null
    return primaryLanguageSubtag(row.language)?.toUpperCase() ?? row.language.toUpperCase()
  }

  const columns = [
    {
      key: 'selection',
      header: (
        <input
          ref={input => {
            if (input) input.indeterminate = someSelected && !allSelected
          }}
          type="checkbox"
          checked={allSelected}
          onChange={onToggleSelectAll}
          aria-label="Select all visible cards"
          className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
        />
      ),
      width: '48px',
      align: 'center' as const,
      render: (_: unknown, row: Entry) => {
        const id = typeof row.id === 'string' ? row.id : ''
        const label = row.word || row.term || row.title || 'card'
        return (
          <input
            type="checkbox"
            checked={!!id && selectedIds.has(id)}
            disabled={!id}
            onClick={event => event.stopPropagation()}
            onChange={() => { if (id) onToggleSelect(id) }}
            aria-label={`Select ${label}`}
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer disabled:cursor-not-allowed"
          />
        )
      },
    },
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
          <span title={row.language ? languageDisplayName(row.language, languages) : undefined}>
            <Badge className={`px-2.5 py-1 text-[11px] ${isJa ? 'bg-amber-bg text-amber-dark' : 'bg-primary-bg text-primary'}`}>
              {code}
            </Badge>
          </span>
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
      {...verifyAttrs({ unit: 'HistoryTable', rows: data.length, selected: selectedIds.size })}
    >
      <DataTable
        data={data}
        columns={columns}
        keyField="id"
        onRowClick={onOpen}
        emptyMessage="No vocabulary cards created yet."
      />
    </div>
  )
}
