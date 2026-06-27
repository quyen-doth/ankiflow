'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { ensureAnkiModel, exportEntryToAnki } from '@/hooks/useAnkiExport'
import { validateCardEntry, formatValidationMessage } from '@/lib/cardValidation'
import type { Entry } from '@/types'

interface CardTypeItem {
  id: string
  name: string
  code?: string
}

interface BatchAnkiExportOptions {
  entries: Partial<Entry>[]
  selectedCardTypeIds: string[]
  cardTypes: CardTypeItem[]
  /** Nhảy tới thẻ lỗi đầu tiên khi validation thất bại. */
  onInvalid: (index: number) => void
}

interface BatchAnkiExportState {
  confirmOpen: boolean
  setConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>
  isExporting: boolean
  progress: { done: number; total: number }
  /** Validate TẤT CẢ trước; nếu đủ → mở modal xác nhận, nếu thiếu → toast + nhảy tới thẻ lỗi. */
  requestExport: () => void
  /** Loop export sau khi người dùng xác nhận. */
  handleExportAll: () => Promise<void>
}

export function useBatchAnkiExport({
  entries,
  selectedCardTypeIds,
  cardTypes,
  onInvalid,
}: BatchAnkiExportOptions): BatchAnkiExportState {
  const router = useRouter()
  const toast = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })

  // Quy tắc: chỉ 1 lỗi validation → KHÔNG tạo thẻ nào. Chặn ngay trước khi mở confirm.
  const requestExport = () => {
    for (let i = 0; i < entries.length; i++) {
      const errs = validateCardEntry(entries[i], selectedCardTypeIds)
      if (errs.length > 0) {
        toast.error(`Card #${i + 1} — ${formatValidationMessage(errs)}`)
        onInvalid(i)
        return
      }
    }
    setConfirmOpen(true)
  }

  const handleExportAll = async () => {
    setIsExporting(true)
    setConfirmOpen(false)
    setProgress({ done: 0, total: entries.length })

    try {
      await ensureAnkiModel()
      const selectedTypes = cardTypes.filter(ct => selectedCardTypeIds.includes(ct.id))

      let totalNotes = 0
      const failed: number[] = []
      for (let i = 0; i < entries.length; i++) {
        setProgress({ done: i, total: entries.length })
        const result = await exportEntryToAnki(entries[i], selectedTypes)
        if (result.ok) {
          totalNotes += result.noteCount
        } else {
          console.error(`Export failed for card #${i + 1}:`, result.error)
          failed.push(i + 1)
        }
      }
      setProgress({ done: entries.length, total: entries.length })

      if (failed.length === entries.length) {
        toast.error('Export failed for all cards. Make sure Anki is open.')
        return
      }
      if (failed.length > 0) {
        toast.warning(`Exported ${entries.length - failed.length}/${entries.length} cards. Failed: #${failed.join(', #')}`)
      } else {
        toast.success(`Created ${totalNotes} cards in Anki`)
      }
      router.push(`/create?exported=1&count=${totalNotes}`)
    } catch (err) {
      console.error('Batch Anki connection error:', err)
      toast.error('Cannot connect to AnkiConnect. Make sure Anki is open.')
    } finally {
      setIsExporting(false)
    }
  }

  return { confirmOpen, setConfirmOpen, isExporting, progress, requestExport, handleExportAll }
}
