'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { SquareCheck, Square } from 'lucide-react'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/providers/AuthProvider'
import { UI_FORM_TYPE_MAP } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'
import { filterCardTypesByScope } from '@/lib/cardTypeFilter'
import { renderCardTypeName } from '@/lib/cardTypeName'
import { FormType } from '@/types'
import type {
  CardTypeConfig,
  LanguageCode,
  StudyLanguage,
} from '@/types'

type UIFormType = 'Language' | 'IT' | 'General'

interface CardTypeSelectorProps {
  formType?: UIFormType | FormType | string
  language?: LanguageCode | ''
  outputLanguage?: LanguageCode
  languages: StudyLanguage[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  label?: string
}

function resolveDatabaseFormType(formType: UIFormType | FormType | string): FormType | string {
  return formType in UI_FORM_TYPE_MAP
    ? UI_FORM_TYPE_MAP[formType as UIFormType]
    : formType
}

export function CardTypeSelector({
  formType = FormType.LANGUAGE,
  language,
  outputLanguage,
  languages,
  selectedIds,
  onChange,
  label = 'Card types to generate',
}: CardTypeSelectorProps) {
  const { user, loading: authLoading } = useAuth()
  const [cardTypes, setCardTypes] = useState<Pick<
    CardTypeConfig,
    | 'id'
    | 'name'
    | 'description'
    | 'language'
    | 'output_language'
    | 'is_active'
    | 'is_default'
    | 'sort_order'
  >[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading || !user) return
    const uid = user.uid
    async function fetchCardTypes() {
      setLoading(true)
      try {
        const dbFormType = resolveDatabaseFormType(formType)
        const q = query(
          collection(db, 'card_types'),
          where('user_id', '==', uid),
          where('form_type', '==', dbFormType),
        )
        const snapshot = await getDocs(q)
        const data = filterCardTypesByScope(
          snapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<CardTypeConfig, 'id'>),
          })),
          {
            studyLanguage: language,
            outputLanguage,
          },
        )
        setCardTypes(data)
      } catch (error) {
        console.error('Error fetching card types', error)
      } finally {
        setLoading(false)
      }
    }
    fetchCardTypes()
  }, [formType, language, outputLanguage, user, authLoading])

  useEffect(() => {
    if (loading) return
    const visibleIds = new Set(cardTypes.map(cardType => cardType.id))
    const nextSelectedIds = selectedIds.filter(id => visibleIds.has(id))
    if (nextSelectedIds.length !== selectedIds.length) {
      onChange(nextSelectedIds)
    }
  }, [cardTypes, loading, onChange, selectedIds])

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
          {loading ? 'Loading card types...' : label}
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
          {cardTypes.length === 0 ? (
            <p className="text-[12px] text-slate-400">
              No card type matches the current language pair. Add one in Admin → Card Types.
            </p>
          ) : (
            cardTypes.map(ct => {
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
                  <span className="truncate">
                    {renderCardTypeName(ct.name, {
                      studyLanguage: language,
                      outputLanguage,
                      cardType: ct,
                      languages,
                    })}
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
