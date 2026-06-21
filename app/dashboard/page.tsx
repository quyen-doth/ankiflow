'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { EntryEditModal } from '@/components/history/EntryEditModal'
import { useEntryEdit } from '@/hooks/useEntryEdit'
import { Layers, BookOpen, CalendarCheck, CheckCircle2, Sparkles, PlusCircle, Inbox, Pencil } from 'lucide-react'
import { FormType, LanguageType, type Entry } from '@/types'

const LANGUAGE_LABELS: Record<string, string> = {
  [LanguageType.ENGLISH]: 'English',
  [LanguageType.JAPANESE]: 'Japanese',
  [LanguageType.CHINESE]: 'Chinese',
}

function entryDate(entry: Entry): Date | null {
  if (!entry.created_at) return null
  return entry.created_at.toDate
    ? entry.created_at.toDate()
    : new Date((entry.created_at as unknown as { seconds: number }).seconds * 1000)
}

function isToday(date: Date | null): boolean {
  if (!date) return false
  const now = new Date()
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate()
}

export default function DashboardPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [editEntry, setEditEntry] = useState<Entry | null>(null)
  const { saveEntry } = useEntryEdit()

  useEffect(() => {
    async function fetchEntries() {
      try {
        const q = query(collection(db, 'entries'), orderBy('created_at', 'desc'), limit(50))
        const snapshot = await getDocs(q)
        setEntries(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Entry)))
      } catch (error) {
        console.error('Error fetching dashboard entries:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchEntries()
  }, [])

  const stats = useMemo(() => {
    const totalCards = entries.reduce((sum, e) => sum + (e.card_type_ids?.length || 0), 0)
    const createdToday = entries.filter(e => isToday(entryDate(e))).length
    const synced = entries.filter(e => e.status === 'synced').length
    const successRate = entries.length > 0 ? Math.round((synced / entries.length) * 100) : 0
    return { totalCards, createdToday, successRate }
  }, [entries])

  const languageBreakdown = useMemo(() => {
    const langEntries = entries.filter(e => e.form_type === FormType.LANGUAGE && e.language)
    const counts = new Map<string, number>()
    langEntries.forEach(e => {
      const key = e.language as string
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    const total = langEntries.length || 1
    return Array.from(counts.entries())
      .map(([lang, count]) => ({ lang, label: LANGUAGE_LABELS[lang] || lang, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count)
  }, [entries])

  const recentEntries = entries.slice(0, 6)

  return (
    <>
      <PageHeader
        title="Welcome back"
        description="Here's a snapshot of your vocabulary journey"
        actions={
          <Button variant="primary" leftIcon={<PlusCircle className="w-4 h-4" />} onClick={() => router.push('/create')}>
            Create New Card
          </Button>
        }
      />

      <div className="max-w-6xl mx-auto w-full pb-12 flex flex-col gap-8">

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Vocabulary"
            value={loading ? '—' : entries.length}
            icon={<BookOpen className="w-5 h-5" />}
          />
          <StatCard
            label="Total Cards"
            value={loading ? '—' : stats.totalCards}
            icon={<Layers className="w-5 h-5" />}
          />
          <StatCard
            label="Created Today"
            value={loading ? '—' : stats.createdToday}
            icon={<CalendarCheck className="w-5 h-5" />}
          />
          <StatCard
            label="Synced to Anki"
            value={loading ? '—' : `${stats.successRate}%`}
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recent entries */}
          <section className="lg:col-span-7 bg-white rounded-xl shadow-card border border-outline-var/40 p-6">
            <h2 className="text-label-lg font-semibold text-on-surface-var mb-4">Recently Created</h2>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              </div>
            ) : recentEntries.length === 0 ? (
              <EmptyState
                icon={<Inbox className="w-6 h-6" />}
                title="No cards yet"
                description="Create your first vocabulary card to see it appear here."
                action={<Button variant="primary" size="sm" onClick={() => router.push('/create')}>Create a card</Button>}
              />
            ) : (
              <div className="flex flex-col divide-y divide-outline-var/30">
                {recentEntries.map(entry => {
                  const word = entry.word || entry.term || entry.title || '—'
                  const meaning = entry.meaning_vi || entry.definition || entry.content || '—'
                  const isSynced = entry.status === 'synced'
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-4 py-3.5 rounded-lg px-2 -mx-2 transition-colors hover:bg-surface-container/60"
                    >
                      <button
                        type="button"
                        onClick={() => router.push(`/history/${entry.id}`)}
                        className="flex-1 min-w-0 text-left focus:outline-none"
                      >
                        <p className="font-serif font-bold text-on-surface truncate">{word}</p>
                        <p className="text-sm text-on-surface-var truncate">{meaning}</p>
                      </button>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditEntry(entry)}
                          className="p-1.5 rounded-lg text-on-surface-var hover:text-primary hover:bg-primary/5 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <Badge className={isSynced ? 'bg-primary/10 text-primary' : 'bg-tertiary-fixed text-on-tertiary-fixed'}>
                          {isSynced ? 'Synced' : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Language breakdown + AI suggestion */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <section className="bg-white rounded-xl shadow-card border border-outline-var/40 p-6">
              <h2 className="text-label-lg font-semibold text-on-surface-var mb-4">Language Breakdown</h2>
              {languageBreakdown.length === 0 ? (
                <p className="text-sm text-on-surface-var">No language vocabulary yet — start by creating a card.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {languageBreakdown.map(({ lang, label, count, pct }) => (
                    <div key={lang}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-on-surface">{label}</span>
                        <span className="text-sm text-on-surface-var">{count} words</span>
                      </div>
                      <div className="h-2 bg-surface-high rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-tertiary-fixed/30 border border-tertiary-fixed border-l-[4px] border-l-tertiary rounded-xl p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-tertiary flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-tertiary mb-1">Suggestion</p>
                <p className="text-sm text-on-surface-var leading-relaxed">
                  Reviewing words in short, frequent sessions improves long-term retention more than cramming. Try creating a few cards each day to build a steady habit.
                </p>
              </div>
            </section>
          </div>
        </div>
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
