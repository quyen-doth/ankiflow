'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Entry } from '@/types'

interface AnkiExportOptions {
  entry: Partial<Entry>
  selectedCardTypeIds: string[]
}

interface AnkiExportState {
  confirmOpen: boolean
  setConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>
  isExporting: boolean
  handleConfirm: () => Promise<void>
}

export function useAnkiExport({ entry, selectedCardTypeIds }: AnkiExportOptions): AnkiExportState {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const handleConfirm = async () => {
    setIsExporting(true)
    setConfirmOpen(false)

    try {
      const res = await fetch('/api/anki/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry: { ...entry, card_type_ids: selectedCardTypeIds },
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        console.error('Anki export failed:', err)
        alert(`Export failed: ${err.error || 'Unknown error'}`)
      } else {
        router.push('/create')
      }
    } catch (err) {
      console.error('Anki connection error:', err)
      alert('Could not connect to AnkiConnect. Please make sure Anki is open.')
    } finally {
      setIsExporting(false)
    }
  }

  return { confirmOpen, setConfirmOpen, isExporting, handleConfirm }
}
