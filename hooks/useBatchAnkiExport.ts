'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { ensureAnkiModel, exportEntryToAnki, saveEntryToFirestore } from '@/hooks/useAnkiExport'
import { collectInvalidCards, type InvalidCard } from '@/lib/cardValidation'
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
  isSaving: boolean
  progress: { done: number; total: number }
  invalid: InvalidCard[]
  clearInvalid: () => void
  requestExport: () => void
  handleExportAll: () => Promise<void>
  handleSaveAll: () => Promise<void>
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
  const [isSaving, setIsSaving] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 })
  const [invalid, setInvalid] = useState<InvalidCard[]>([])

  const clearInvalid = () => setInvalid([])

  // Quy tắc: BẤT KỲ thẻ nào lỗi → KHÔNG tạo thẻ nào. Gom hết lỗi để hiện banner + đánh dấu nav strip.
  const checkAll = (): boolean => {
    const bad = collectInvalidCards(entries, selectedCardTypeIds)
    setInvalid(bad)
    if (bad.length > 0) {
      onInvalid(bad[0].index)
      return false
    }
    return true
  }

  const requestExport = () => {
    if (!checkAll()) return
    setConfirmOpen(true)
  }

  const handleSaveAll = async () => {
    if (!checkAll()) return

    setIsSaving(true)
    try {
      const selectedTypes = cardTypes.filter(ct => selectedCardTypeIds.includes(ct.id))
      let saved = 0
      const failed: number[] = []

      for (let i = 0; i < entries.length; i++) {
        const result = await saveEntryToFirestore(entries[i], selectedTypes)
        if (result.ok) {
          saved++
        } else {
          console.error(`Save failed for card #${i + 1}:`, result.error)
          failed.push(i + 1)
        }
      }

      if (failed.length === entries.length) {
        toast.error('Save failed for all cards.')
        return
      }
      if (failed.length > 0) {
        toast.warning(`Saved ${saved}/${entries.length} cards. Failed: #${failed.join(', #')}`)
      } else {
        toast.success(`Saved ${saved} cards. Sync to Anki later.`)
      }
      router.push(`/create?saved=1&count=${saved}`)
    } catch (err) {
      console.error('Batch save error:', err)
      toast.error('Save failed. Please try again.')
    } finally {
      setIsSaving(false)
    }
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
      // 成功フィードバックは上の toast が担当 — create 側の ?exported= バナーは廃止済み。
      router.push('/create')
    } catch (err) {
      console.error('Batch Anki connection error:', err)
      toast.error('Cannot connect to AnkiConnect. Make sure Anki is open.')
    } finally {
      setIsExporting(false)
    }
  }

  return { confirmOpen, setConfirmOpen, isExporting, isSaving, progress, invalid, clearInvalid, requestExport, handleExportAll, handleSaveAll }
}
