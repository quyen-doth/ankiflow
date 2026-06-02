'use client'

import { useRouter } from 'next/navigation'
import { DataTable } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Eye, Trash2 } from 'lucide-react'
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
      header: 'Từ vựng',
      render: (_: unknown, row: Entry) => (
        <span className="font-serif font-bold text-lg text-gray-900">
          {row.word || row.term || row.title || '—'}
        </span>
      ),
    },
    {
      key: 'meaning',
      header: 'Nghĩa',
      render: (_: unknown, row: Entry) => (
        <span className="text-gray-600">
          {row.meaning_vi || row.definition || row.content || '—'}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Phân loại',
      render: (_: unknown, row: Entry) => {
        let label = 'General'
        if (row.form_type === 'form_language') label = row.language || 'Language'
        if (row.form_type === 'form_it') label = 'IT & Dev'
        return (
          <Badge className="bg-[#EFECE5] text-gray-700 font-medium px-3 py-1">
            {label}
          </Badge>
        )
      },
    },
    {
      key: 'anki_deck',
      header: 'Deck',
      render: (_: unknown, row: Entry) => (
        <span className="text-gray-800 font-medium">
          {row.anki_deck || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (_: unknown, row: Entry) => {
        const isSynced = row.status === 'synced'
        return (
          <Badge className={isSynced ? 'bg-[#E3F2E8] text-[#1B4D3E]' : 'bg-[#FFF3CD] text-[#856404]'}>
            {isSynced ? 'Đã đồng bộ' : 'Chờ đồng bộ'}
          </Badge>
        )
      },
    },
    {
      key: 'created_at',
      header: 'Ngày tạo',
      render: (_: unknown, row: Entry) => {
        if (!row.created_at) return '—'
        const date = row.created_at.toDate ? row.created_at.toDate() : new Date((row.created_at as any).seconds * 1000)
        return <span className="text-gray-500 text-sm">{date.toLocaleDateString('vi-VN')}</span>
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
            className="p-2 h-auto text-gray-500 hover:text-[#316342] hover:bg-[#F6F4EF] rounded-full"
            title="Xem chi tiết"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.(row.id as string)
            }}
            className="p-2 h-auto text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full"
            title="Xóa"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
      <DataTable
        data={data}
        columns={columns}
        keyField="id"
        onRowClick={(row) => router.push(`/history/${row.id}`)}
        emptyMessage="Chưa có từ vựng nào được tạo."
      />
    </div>
  )
}
