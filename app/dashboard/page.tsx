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
import { FlowTip } from '@/components/ui/FlowTip'
import { Layers, BookOpen, CalendarCheck, CheckCircle2, PlusCircle, Inbox, Search, ArrowRight } from 'lucide-react'
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
  const [searchQuery, setSearchQuery] = useState('')

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
        title="Dashboard"
        description="A snapshot of your vocabulary library."
        actions={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search cards…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[200px] h-[38px] pl-9 pr-10 bg-white border border-border rounded-[9px] text-sm text-ink placeholder:text-slate-400/60 focus:border-primary focus:ring-[3px] focus:ring-primary-bg focus:outline-none"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-400 border border-border rounded px-1.5 py-0.5">/</kbd>
            </div>
            <Button variant="primary" leftIcon={<PlusCircle className="w-4 h-4" />} onClick={() => router.push('/create')}>
              Create card
              <kbd className="ml-2 text-xs font-semibold opacity-70 tracking-wide">⌘N</kbd>
            </Button>
          </div>
        }
      />

      <div className="max-w-6xl mx-auto w-full pb-12 flex flex-col gap-8">

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Vocabulary"
            value={loading ? '—' : entries.length}
            icon={<BookOpen className="w-5 h-5" />}
          />
          <StatCard
            label="Cards"
            value={loading ? '—' : stats.totalCards}
            icon={<Layers className="w-5 h-5" />}
          />
          <StatCard
            label="Today"
            value={loading ? '—' : stats.createdToday}
            icon={<CalendarCheck className="w-5 h-5" />}
          />
          <StatCard
            label="Synced"
            value={loading ? '—' : `${stats.successRate}%`}
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Recent entries */}
          <section className="lg:col-span-7 bg-white rounded-card border border-border/40 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-overline uppercase tracking-[0.05em] text-slate-400 font-mono font-bold">Recently created</h2>
              <button
                type="button"
                onClick={() => router.push('/history')}
                className="flex items-center gap-1.5 text-[13px] font-medium text-ink hover:text-primary transition-colors"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
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
              <div className="flex flex-col divide-y divide-border">
                {recentEntries.map(entry => {
                  const word = entry.word || entry.term || entry.title || '—'
                  const meaning = entry.meaning_vi || entry.definition || entry.content || '—'
                  const isSynced = entry.status === 'synced'
                  const langCode = entry.form_type === FormType.LANGUAGE && entry.language
                    ? entry.language === LanguageType.JAPANESE ? 'JA'
                      : entry.language === LanguageType.CHINESE ? 'ZH'
                      : 'EN'
                    : null
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => router.push(`/history/${entry.id}`)}
                      className="flex items-center gap-3 py-3.5 text-left transition-colors hover:bg-surface/60 rounded-lg px-2 -mx-2"
                    >
                      {langCode && (
                        <Badge variant={langCode === 'JA' ? 'pending' : 'language'} className="text-[11px] px-2.5 py-1 flex-shrink-0">
                          {langCode}
                        </Badge>
                      )}
                      <span className="flex-1 min-w-0 truncate">
                        <span className="font-bold text-ink">{word}</span>
                        <span className="text-slate-600 ml-2">{meaning}</span>
                      </span>
                      <Badge className={`flex-shrink-0 ${isSynced ? 'bg-primary-bg text-primary' : 'bg-amber-bg text-amber-dark'}`}>
                        <span className={`inline-block w-[6px] h-[6px] rounded-full mr-1.5 ${isSynced ? 'bg-primary' : 'bg-amber'}`} />
                        {isSynced ? 'Synced' : 'Pending'}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {/* Language breakdown + AI suggestion */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <section className="bg-white rounded-card border border-border/40 p-6">
              <h2 className="text-overline uppercase tracking-[0.05em] text-slate-400 font-mono font-bold mb-4">By language</h2>
              {languageBreakdown.length === 0 ? (
                <p className="text-sm text-slate-600">No language vocabulary yet — start by creating a card.</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {languageBreakdown.map(({ lang, label, count, pct }) => (
                    <div key={lang}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-ink">{label}</span>
                        <span className="text-sm text-slate-600">{count}</span>
                      </div>
                      <div className="h-2 bg-canvas rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${lang === LanguageType.JAPANESE ? 'bg-amber' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <FlowTip label="Tip">
              Short, frequent sessions beat cramming. A few cards a day compounds fast.
            </FlowTip>
          </div>
        </div>
      </div>

    </>
  )
}
