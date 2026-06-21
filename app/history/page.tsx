'use client'

import { useState, useEffect } from 'react'
import { collection, query, orderBy, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { PageHeader } from '@/components/layout/PageHeader'
import { FilterBar } from '@/components/ui/FilterBar'
import { HistoryTable } from '@/components/history/HistoryTable'
import { EntryEditModal } from '@/components/history/EntryEditModal'
import { useEntryEdit } from '@/hooks/useEntryEdit'
import type { Entry } from '@/types'

export default function HistoryPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
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

  // Basic search filter
  const filteredEntries = entries.filter(entry => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    const word = (entry.word || entry.term || entry.title || '').toLowerCase()
    const meaning = (entry.meaning_vi || entry.definition || entry.content || '').toLowerCase()
    return word.includes(searchLower) || meaning.includes(searchLower)
  })

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'History', href: '/history' }
        ]}
        title="Card History"
        description="Review and manage the cards you've created"
      />

      <div className="max-w-6xl mx-auto w-full pb-12 flex flex-col gap-6">
        {/* Filter Bar */}
        <div className="bg-white rounded-xl p-6 shadow-card">
          <FilterBar
            searchPlaceholder="Search vocabulary, meaning..."
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            // Thêm activeFilters, onFilterClick, etc. sau nếu cần
          />
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
    </>
  )
}
