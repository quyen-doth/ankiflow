'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/providers/AuthProvider'
import { useStudyLanguages } from '@/components/providers/StudyLanguageProvider'
import { PageHeader } from '@/components/layout/PageHeader'
import { MotionPage } from '@/components/ui/MotionPage'
import { FilterBar } from '@/components/ui/FilterBar'
import { Select } from '@/components/ui/FormField'
import { HistoryTable } from '@/components/history/HistoryTable'
import { EntryEditModal } from '@/components/history/EntryEditModal'
import { Button } from '@/components/ui/Button'
import { useEntryEdit } from '@/hooks/useEntryEdit'
import { PlusCircle } from 'lucide-react'
import { FormType, type Entry, type UserContentType } from '@/types'
import { canonicalizeLanguageCode, languageDisplayName } from '@/lib/studyLanguages'
import { loadUserContentTypes } from '@/lib/userContentTypes'
import {
  ALL_HISTORY_FILTERS,
  DEFAULT_HISTORY_FILTERS,
  filterHistoryEntries,
  type HistoryFilters,
  type HistoryStatusFilter,
} from '@/lib/history/filterEntries'

const STATUS_FILTER_OPTIONS: Array<{ value: HistoryStatusFilter; label: string }> = [
  { value: ALL_HISTORY_FILTERS, label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'reviewed', label: 'Unsynced' },
  { value: 'synced', label: 'Synced' },
]

export default function HistoryPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { languages } = useStudyLanguages()
  const [entries, setEntries] = useState<Entry[]>([])
  const [contentTypes, setContentTypes] = useState<UserContentType[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_HISTORY_FILTERS)
  const [editEntry, setEditEntry] = useState<Entry | null>(null)
  const { saveEntry } = useEntryEdit()

  useEffect(() => {
    // Chưa có user (authLoading hoặc null) → giữ spinner; middleware đảm bảo đã login
    if (authLoading || !user) return
    async function fetchHistory(uid: string) {
      try {
        const q = query(
          collection(db, 'entries'),
          where('user_id', '==', uid),
          orderBy('created_at', 'desc')
        )
        const [snapshot, workspaceContentTypes] = await Promise.all([
          getDocs(q),
          loadUserContentTypes(uid),
        ])
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Entry))
        setEntries(data)
        setContentTypes(workspaceContentTypes)
      } catch (error) {
        console.error('Error fetching history:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory(user.uid)
  }, [user, authLoading])

  const contentTypeOptions = useMemo(() => {
    const labels = new Map<string, string>()
    const sortedContentTypes = [...contentTypes].sort((a, b) => (
      a.sort_order - b.sort_order || a.name.localeCompare(b.name)
    ))
    sortedContentTypes.forEach(contentType => {
      if (!labels.has(contentType.code)) labels.set(contentType.code, contentType.name)
    })
    entries.forEach(entry => {
      if (!labels.has(entry.form_type)) labels.set(entry.form_type, entry.form_type)
    })

    return [
      { value: ALL_HISTORY_FILTERS, label: 'All content types' },
      ...Array.from(labels, ([value, label]) => ({ value, label })),
    ]
  }, [contentTypes, entries])

  const languageOptions = useMemo(() => {
    // 有効な設定言語と実データに残る言語を統合する。
    const codes = new Set<string>()
    languages.forEach(language => {
      if (!language.enabled) return
      const code = canonicalizeLanguageCode(language.code)
      if (code) codes.add(code)
    })
    entries.forEach(entry => {
      if (entry.form_type !== FormType.LANGUAGE || !entry.language) return
      codes.add(canonicalizeLanguageCode(entry.language) ?? entry.language)
    })
    return [
      { value: ALL_HISTORY_FILTERS, label: 'All languages' },
      ...Array.from(codes).map(code => ({ value: code, label: languageDisplayName(code, languages) })),
    ]
  }, [entries, languages])

  const filteredEntries = useMemo(
    () => filterHistoryEntries(entries, filters),
    [entries, filters],
  )
  const filteredNoteCount = filteredEntries.reduce(
    (sum, entry) => sum + (entry.card_type_ids?.length || 0),
    0,
  )

  const activeFilters = useMemo(() => {
    const active: Array<{ key: string; label: string }> = []
    if (filters.search) active.push({ key: 'search', label: `Search: ${filters.search}` })
    if (filters.contentType !== ALL_HISTORY_FILTERS) {
      const label = contentTypeOptions.find(option => option.value === filters.contentType)?.label
        ?? filters.contentType
      active.push({ key: 'contentType', label: `Content type: ${label}` })
    }
    if (
      filters.contentType === FormType.LANGUAGE
      && filters.language !== ALL_HISTORY_FILTERS
    ) {
      const label = languageOptions.find(option => option.value === filters.language)?.label
        ?? filters.language
      active.push({ key: 'language', label: `Language: ${label}` })
    }
    if (filters.status !== ALL_HISTORY_FILTERS) {
      const label = STATUS_FILTER_OPTIONS.find(option => option.value === filters.status)?.label
        ?? filters.status
      active.push({ key: 'status', label: `Status: ${label}` })
    }
    return active
  }, [contentTypeOptions, filters, languageOptions])

  const changeContentType = (contentType: string) => {
    setFilters(current => ({
      ...current,
      contentType,
      language: contentType === FormType.LANGUAGE
        ? current.language
        : ALL_HISTORY_FILTERS,
    }))
  }

  const removeFilter = (key: string) => {
    setFilters(current => {
      if (key === 'search') return { ...current, search: '' }
      if (key === 'contentType') {
        return {
          ...current,
          contentType: ALL_HISTORY_FILTERS,
          language: ALL_HISTORY_FILTERS,
        }
      }
      if (key === 'language') return { ...current, language: ALL_HISTORY_FILTERS }
      if (key === 'status') return { ...current, status: ALL_HISTORY_FILTERS }
      return current
    })
  }

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
        {/* Search と data-driven dropdown を desktop で 1 行にまとめる。 */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
          <div className="flex-1 min-w-[240px]">
            <FilterBar
              searchPlaceholder="Search vocabulary, meaning…"
              searchValue={filters.search}
              onSearchChange={search => setFilters(current => ({ ...current, search }))}
              activeFilters={activeFilters}
              onRemoveFilter={removeFilter}
              onClearAll={() => setFilters({ ...DEFAULT_HISTORY_FILTERS })}
            />
          </div>
          <div className="w-full sm:w-[200px]">
            <Select
              aria-label="Content type"
              value={filters.contentType}
              onChange={event => changeContentType(event.target.value)}
            >
              {contentTypeOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
          {filters.contentType === FormType.LANGUAGE && (
            <div className="w-full sm:w-[180px]">
              <Select
                aria-label="Language"
                value={filters.language}
                onChange={event => setFilters(current => ({
                  ...current,
                  language: event.target.value,
                }))}
              >
                {languageOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="w-full sm:w-[160px]">
            <Select
              aria-label="Status"
              value={filters.status}
              onChange={event => setFilters(current => ({
                ...current,
                status: event.target.value as HistoryStatusFilter,
              }))}
            >
              {STATUS_FILTER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
          <span className="h-[42px] flex items-center text-[13px] font-mono text-slate-400 whitespace-nowrap">
            {filteredEntries.length}/{entries.length} cards · {filteredNoteCount} notes
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
