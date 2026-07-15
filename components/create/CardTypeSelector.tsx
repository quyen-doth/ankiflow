'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { SquareCheck, Square } from 'lucide-react'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/providers/AuthProvider'
import { UI_FORM_TYPE_MAP } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'
import type { CardTypeConfig, LanguageCode } from '@/types'

type UIFormType = 'Language' | 'IT' | 'General'

interface CardTypeSelectorProps {
  formType?: UIFormType
  language?: LanguageCode | ''
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function CardTypeSelector({ formType = 'Language', language, selectedIds, onChange }: CardTypeSelectorProps) {
  const { user, loading: authLoading } = useAuth()
  const [cardTypes, setCardTypes] = useState<Pick<CardTypeConfig, 'id' | 'name' | 'description' | 'language' | 'sort_order'>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading || !user) return
    const uid = user.uid
    async function fetchCardTypes() {
      setLoading(true)
      try {
        const dbFormType = UI_FORM_TYPE_MAP[formType]
        const q = query(
          collection(db, 'card_types'),
          where('user_id', '==', uid),
          where('form_type', '==', dbFormType),
        )
        const snapshot = await getDocs(q)
        let data = snapshot.docs
          .map(doc => ({ id: doc.id, ...(doc.data() as Pick<CardTypeConfig, 'name' | 'description' | 'language' | 'sort_order' | 'is_active'>) }))
          .filter(ct => ct.is_active !== false)

        if (formType === 'Language' && language) {
          data = data.filter(ct => !ct.language || ct.language === language)
        }

        data.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        setCardTypes(data)
      } catch (error) {
        console.error('Error fetching card types', error)
      } finally {
        setLoading(false)
      }
    }
    fetchCardTypes()
  }, [formType, language, user, authLoading])

  const handleToggle = (id: string) => {
    onChange(selectedIds.includes(id)
      ? selectedIds.filter(v => v !== id)
      : [...selectedIds, id]
    )
  }

  const selectAll = () => onChange(cardTypes.map(ct => ct.id))
  const clearAll = () => onChange([])

  return (
    <div
      className="border-t border-[#f0f0ec] pt-[18px]"
      {...verifyAttrs({ unit: 'CardTypeSelector', count: cardTypes.length, selected: selectedIds.length, loading })}
    >
      <div className="flex justify-between items-center mb-3">
        <label className="text-[11px] font-bold tracking-[0.04em] uppercase font-mono text-slate-400">
          {loading ? 'Loading card types...' : 'Card types to generate'}
        </label>
        <div className="flex gap-3">
          <button type="button" onClick={selectAll} disabled={loading} className="text-[12px] font-bold text-primary hover:underline disabled:opacity-50">All</button>
          <button type="button" onClick={clearAll} disabled={loading} className="text-[12px] font-semibold text-slate-400 hover:text-ink disabled:opacity-50">Clear</button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-[38px] w-28 rounded-[9px] bg-surface animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {cardTypes.map(ct => {
            const isChecked = selectedIds.includes(ct.id)
            return (
              <button
                key={ct.id}
                type="button"
                onClick={() => handleToggle(ct.id)}
                className={cn(
                  'inline-flex items-center gap-[7px] px-3 py-2 rounded-[9px] text-[13px] font-semibold border transition-colors duration-150',
                  isChecked
                    ? 'bg-[rgba(49,99,66,0.07)] border-[#cfe0d6] text-ink'
                    : 'bg-[#fcfcfb] border-border text-slate-600 hover:bg-canvas'
                )}
              >
                {isChecked
                  ? <SquareCheck className="w-[15px] h-[15px] text-primary flex-shrink-0" />
                  : <Square className="w-[15px] h-[15px] text-[#cdd0d3] flex-shrink-0" />}
                <span className="truncate">{ct.name}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
