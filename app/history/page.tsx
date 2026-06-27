'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, orderBy, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { PageHeader } from '@/components/layout/PageHeader'
import { MotionPage } from '@/components/ui/MotionPage'
import { FilterBar } from '@/components/ui/FilterBar'
import { HistoryTable } from '@/components/history/HistoryTable'
import { EntryEditModal } from '@/components/history/EntryEditModal'
import { Button } from '@/components/ui/Button'
import { useEntryEdit } from '@/hooks/useEntryEdit'
import { PlusCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FormType, type Entry } from '@/types'

const LANG_FILTERS = ['All', 'English', 'Japanese', 'IT'] as const
type LangFilter = (typeof LANG_FILTERS)[number]

export default function HistoryPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [langFilter, setLangFilter] = useState<LangFilter>('All')
  const [editEntry, setEditEntry] = useState<Entry | null>(null)
  const { saveEntry } = useEntryEdit()

  useEffect(() => {
    async function fetchHistory() {
      try {
        const q = query(
          collection(db, 'entries'),
          orderBy('created_at', 'desc')
        )
        const snapshot = await getDocs(q)
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Entry))
        setEntries(data)
      } catch (error) {
        console.error('Error fetching history:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [])

  const totalCards = entries.reduce((sum, e) => sum + (e.card_type_ids?.length || 0), 0)

  const filteredEntries = entries.filter(entry => {
    if (langFilter !== 'All') {
      if (langFilter === 'IT') {
        if (entry.form_type !== FormType.IT) return false
      } else {
        if (entry.form_type !== FormType.LANGUAGE) return false
        const lang = entry.language?.toLowerCase() || ''
        if (langFilter === 'English' && lang !== 'en') return false
        if (langFilter === 'Japanese' && lang !== 'ja') return false
      }
    }
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    const word = (entry.word || entry.term || entry.title || '').toLowerCase()
    const meaning = (entry.meaning_vi || entry.definition || entry.content || '').toLowerCase()
    return word.includes(searchLower) || meaning.includes(searchLower)
  })

  return (
    <MotionPage>
      <PageHeader
        title="Card history"
        description="Review and manage the cards you've created."
        actions={
          <Button variant="primary" leftIcon={<PlusCircle className="w-4 h-4" />} onClick={() => router.push('/create')}>
            Create card
          </Button>
        }
      />

      <div className="max-w-6xl mx-auto w-full pb-12 flex flex-col gap-6">
        {/* Filter Bar + Language pills + Count */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <FilterBar
              searchPlaceholder="Search vocabulary, meaning…"
              searchValue={searchTerm}
              onSearchChange={setSearchTerm}
            />
          </div>
          <div className="flex items-center gap-1.5">
            {LANG_FILTERS.map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setLangFilter(f)}
                className={cn(
                  'px-3.5 py-1.5 rounded-pill text-[12.5px] font-semibold transition-colors',
                  langFilter === f
                    ? 'bg-primary text-white'
                    : 'text-slate-600 hover:bg-surface'
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <span className="text-[13px] font-mono text-slate-400 whitespace-nowrap">
            {entries.length} cards · {totalCards} notes
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          </div>
        ) : (
          <HistoryTable
            data={filteredEntries}
            onEdit={(entry) => setEditEntry(entry)}
          />
        )}
      </div>

      {editEntry && (
        <EntryEditModal
          open={!!editEntry}
          onClose={() => setEditEntry(null)}
          entry={editEntry}
          onSave={async (updates) => {
            await saveEntry(editEntry, updates)
            setEntries(prev => prev.map(e =>
              e.id === editEntry.id ? { ...e, ...updates } : e
            ))
            setEditEntry(null)
          }}
        />
      )}
    </MotionPage>
  )
}
