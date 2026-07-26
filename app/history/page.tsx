'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import { useStudyLanguages } from '@/components/providers/StudyLanguageProvider'
import { PageHeader } from '@/components/layout/PageHeader'
import { MotionPage } from '@/components/ui/MotionPage'
import { FilterBar } from '@/components/ui/FilterBar'
import { Select } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { HistoryTable } from '@/components/history/HistoryTable'
import { EntryEditModal } from '@/components/history/EntryEditModal'
import { Button } from '@/components/ui/Button'
import { useEntryEdit } from '@/hooks/useEntryEdit'
import { useEntryDelete } from '@/hooks/useEntryDelete'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { PlusCircle, Trash2 } from 'lucide-react'
import { FormType, type Entry, type UserContentType } from '@/types'
import { canonicalizeLanguageCode, languageDisplayName } from '@/lib/studyLanguages'
import { loadUserContentTypes } from '@/lib/userContentTypes'
import {
  applyHistorySummaryUpdates,
  type HistoryEntrySummary,
  type HistoryFacetsResponse,
} from '@/lib/history/historyDto'
import {
  HISTORY_SEARCH_DEBOUNCE_MS,
  requestHistory,
} from '@/lib/history/historyClient'
import {
  ALL_HISTORY_FILTERS,
  buildHistoryContentTypeOptions,
  DEFAULT_HISTORY_FILTERS,
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
  const uid = user?.uid
  const { languages } = useStudyLanguages()
  const [entries, setEntries] = useState<HistoryEntrySummary[]>([])
  const [contentTypes, setContentTypes] = useState<UserContentType[]>([])
  const [facetFormTypes, setFacetFormTypes] = useState<string[]>([])
  const [facetLanguages, setFacetLanguages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_HISTORY_FILTERS)
  const [searchDraft, setSearchDraft] = useState(DEFAULT_HISTORY_FILTERS.search)
  const settledSearch = useDebouncedValue(searchDraft, HISTORY_SEARCH_DEBOUNCE_MS)
  const [editEntry, setEditEntry] = useState<Entry | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HistoryEntrySummary[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [deleting, setDeleting] = useState(false)
  const historyRequestRef = useRef<AbortController | null>(null)
  const editRequestRef = useRef<AbortController | null>(null)
  const { saveEntry } = useEntryEdit()
  const { deleteEntries } = useEntryDelete()
  const toast = useToast()

  useEffect(() => {
    if (authLoading || !uid) return

    let cancelled = false
    const controller = new AbortController()

    loadUserContentTypes(uid)
      .then(workspaceContentTypes => {
        if (!cancelled) setContentTypes(workspaceContentTypes)
      })
      .catch(error => {
        if (!cancelled) console.error('Error fetching Content Types:', error)
      })

    fetch('/api/history/facets', { signal: controller.signal })
      .then(async facetsResponse => {
        if (!facetsResponse.ok) throw new Error('Failed to load history filters')
        const facets = await facetsResponse.json() as Partial<HistoryFacetsResponse>
        if (cancelled) return
        setFacetFormTypes(Array.isArray(facets.form_types) ? facets.form_types : [])
        setFacetLanguages(Array.isArray(facets.languages) ? facets.languages : [])
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          console.error('Error fetching history metadata:', error)
        }
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [authLoading, uid])

  useEffect(() => {
    if (authLoading || !uid) return

    historyRequestRef.current?.abort()
    const controller = new AbortController()
    historyRequestRef.current = controller

    Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return undefined
        setEntries([])
        setTotal(0)
        setNextCursor(null)
        setSelectedIds(new Set())
        setLoadingMore(false)
        setLoading(true)
        return requestHistory(filters, undefined, controller.signal)
      })
      .then(result => {
        if (!result) return
        if (historyRequestRef.current !== controller || controller.signal.aborted) return
        setEntries(result.entries)
        setTotal(result.total)
        setNextCursor(result.next_cursor)
      })
      .catch(error => {
        if (controller.signal.aborted) return
        console.error('Error fetching history:', error)
        toast.error(error instanceof Error ? error.message : 'Failed to load card history')
      })
      .finally(() => {
        if (historyRequestRef.current === controller) {
          historyRequestRef.current = null
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [authLoading, filters, toast, uid])

  useEffect(() => {
    if (settledSearch !== searchDraft || settledSearch === filters.search) return
    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return
      historyRequestRef.current?.abort()
      setFilters(current => (
        current.search === settledSearch
          ? current
          : { ...current, search: settledSearch }
      ))
      setSelectedIds(new Set())
    })
    return () => {
      cancelled = true
    }
  }, [filters.search, searchDraft, settledSearch])

  useEffect(() => () => {
    editRequestRef.current?.abort()
  }, [])

  const contentTypeOptions = useMemo(() => {
    return buildHistoryContentTypeOptions(contentTypes, [
      ...entries,
      ...facetFormTypes.map(form_type => ({ form_type })),
    ])
  }, [contentTypes, entries, facetFormTypes])

  const languageOptions = useMemo(() => {
    // 有効な設定言語と実データに残る言語を統合する。
    const codes = new Set<string>()
    languages.forEach(language => {
      if (!language.enabled) return
      const code = canonicalizeLanguageCode(language.code)
      if (code) codes.add(code)
    })
    facetLanguages.forEach(language => {
      codes.add(canonicalizeLanguageCode(language) ?? language)
    })
    entries.forEach(entry => {
      if (entry.form_type !== FormType.LANGUAGE || !entry.language) return
      codes.add(canonicalizeLanguageCode(entry.language) ?? entry.language)
    })
    return [
      { value: ALL_HISTORY_FILTERS, label: 'All languages' },
      ...Array.from(codes).map(code => ({ value: code, label: languageDisplayName(code, languages) })),
    ]
  }, [entries, facetLanguages, languages])

  const selectedEntries = useMemo(
    () => entries.filter(entry => selectedIds.has(entry.id)),
    [entries, selectedIds],
  )

  const applyFilters = (nextFilters: HistoryFilters) => {
    historyRequestRef.current?.abort()
    setFilters(nextFilters)
    setSelectedIds(new Set())
  }

  const toggleSelected = (id: string) => {
    setSelectedIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllVisible = () => {
    const visibleIds = entries.map(entry => entry.id)
    setSelectedIds(current => {
      const next = new Set(current)
      const allVisibleSelected = visibleIds.length > 0
        && visibleIds.every(id => next.has(id))
      visibleIds.forEach(id => {
        if (allVisibleSelected) next.delete(id)
        else next.add(id)
      })
      return next
    })
  }
  const loadedNoteCount = entries.reduce(
    (sum, entry) => sum + entry.card_count,
    0,
  )

  const loadMore = async () => {
    if (!nextCursor || loading || loadingMore) return
    historyRequestRef.current?.abort()
    const controller = new AbortController()
    historyRequestRef.current = controller
    setLoadingMore(true)

    try {
      const result = await requestHistory(filters, nextCursor, controller.signal)
      if (historyRequestRef.current !== controller || controller.signal.aborted) return
      setEntries(current => {
        const existingIds = new Set(current.map(entry => entry.id))
        return [
          ...current,
          ...result.entries.filter(entry => !existingIds.has(entry.id)),
        ]
      })
      setTotal(result.total)
      setNextCursor(result.next_cursor)
    } catch (error) {
      if (controller.signal.aborted) return
      console.error('Error loading more history:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to load more cards')
    } finally {
      if (historyRequestRef.current === controller) {
        historyRequestRef.current = null
        setLoadingMore(false)
      }
    }
  }

  const openEdit = async (entry: HistoryEntrySummary) => {
    editRequestRef.current?.abort()
    const controller = new AbortController()
    editRequestRef.current = controller
    setEditingId(entry.id)

    try {
      const response = await fetch(`/api/history/${encodeURIComponent(entry.id)}`, {
        signal: controller.signal,
      })
      const body = await response.json().catch(() => ({})) as {
        entry?: Entry
        error?: string
      }
      if (!response.ok || !body.entry) {
        throw new Error(body.error || 'Failed to load card details')
      }
      if (editRequestRef.current !== controller || controller.signal.aborted) return
      setEditEntry(body.entry)
    } catch (error) {
      if (controller.signal.aborted) return
      toast.error(error instanceof Error ? error.message : 'Failed to load card details')
    } finally {
      if (editRequestRef.current === controller) {
        editRequestRef.current = null
        setEditingId(null)
      }
    }
  }

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
    applyFilters({
      ...filters,
      contentType,
      language: contentType === FormType.LANGUAGE
        ? filters.language
        : ALL_HISTORY_FILTERS,
    })
  }

  const removeFilter = (key: string) => {
    let nextFilters = filters
    if (key === 'search') {
      setSearchDraft('')
      nextFilters = { ...filters, search: '' }
    }
    if (key === 'contentType') {
      nextFilters = {
        ...filters,
        contentType: ALL_HISTORY_FILTERS,
        language: ALL_HISTORY_FILTERS,
      }
    }
    if (key === 'language') nextFilters = { ...filters, language: ALL_HISTORY_FILTERS }
    if (key === 'status') nextFilters = { ...filters, status: ALL_HISTORY_FILTERS }
    applyFilters(nextFilters)
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleteTarget.length === 0 || deleting) return
    const targets = deleteTarget
    const targetIds = new Set(targets.flatMap(entry => entry.id ? [entry.id] : []))
    const hasAnkiNotes = targets.some(entry => (entry.anki_note_ids?.length ?? 0) > 0)
    setDeleting(true)

    try {
      const result = await deleteEntries(targets)
      setEntries(current => current.filter(entry => !entry.id || !targetIds.has(entry.id)))
      setTotal(current => Math.max(0, current - result.deleted))
      setSelectedIds(new Set())
      setDeleteTarget(null)
      toast.success(`Deleted ${result.deleted} card${result.deleted === 1 ? '' : 's'}`)
      if (!result.ankiCleaned && hasAnkiNotes) {
        toast.info('Anki notes will be removed on next Sync')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete cards')
    } finally {
      setDeleting(false)
    }
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
              searchValue={searchDraft}
              onSearchChange={setSearchDraft}
              activeFilters={activeFilters}
              onRemoveFilter={removeFilter}
              onClearAll={() => {
                setSearchDraft(DEFAULT_HISTORY_FILTERS.search)
                applyFilters({ ...DEFAULT_HISTORY_FILTERS })
              }}
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
                onChange={event => applyFilters({
                  ...filters,
                  language: event.target.value,
                })}
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
              onChange={event => applyFilters({
                ...filters,
                status: event.target.value as HistoryStatusFilter,
              })}
            >
              {STATUS_FILTER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </div>
          <span className="h-[42px] flex items-center text-[13px] font-mono text-slate-400 whitespace-nowrap">
            {entries.length}/{total} cards loaded · {loadedNoteCount} notes
          </span>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex flex-col gap-3 rounded-[9px] border border-danger/20 bg-danger-bg px-4 py-3 sm:flex-row sm:items-center">
            <span className="text-sm font-bold text-danger">
              {selectedIds.size} selected
            </span>
            <div className="flex gap-2 sm:ml-auto">
              <Button
                variant="destructive"
                size="sm"
                leftIcon={<Trash2 className="h-4 w-4" />}
                onClick={() => setDeleteTarget(selectedEntries)}
                disabled={deleting || selectedEntries.length === 0}
              >
                Delete
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                disabled={deleting}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          </div>
        ) : (
          <HistoryTable
            data={entries}
            selectedIds={selectedIds}
            editingId={editingId}
            hasMore={!!nextCursor}
            loadingMore={loadingMore}
            onToggleSelect={toggleSelected}
            onToggleSelectAll={toggleAllVisible}
            onLoadMore={loadMore}
            onOpen={(entry) => router.push(`/history/${entry.id}`)}
            onEdit={openEdit}
            onDelete={(id) => {
              const entry = entries.find(candidate => candidate.id === id)
              if (entry) setDeleteTarget([entry])
            }}
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
              e.id === editEntry.id ? applyHistorySummaryUpdates(e, updates) : e
            ))
            setEditEntry(null)
          }}
        />
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => { if (!deleting) setDeleteTarget(null) }}
        onConfirm={confirmDelete}
        title={deleteTarget?.length === 1 ? 'Delete card?' : `Delete ${deleteTarget?.length ?? 0} cards?`}
        size="sm"
      >
        <p className="text-sm text-slate-600">
          Delete {deleteTarget?.length === 1 ? 'this card' : 'these cards'} permanently? Cards already exported to Anki will also be removed
          from Anki immediately if it is open, or on the next Sync.
        </p>
        <div className="flex gap-3 justify-end mt-5">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </MotionPage>
  )
}
