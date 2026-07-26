'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/providers/AuthProvider'
import { useStudyLanguages } from '@/components/providers/StudyLanguageProvider'
import { PageHeader } from '@/components/layout/PageHeader'
import { MotionPage } from '@/components/ui/MotionPage'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { FlowTip } from '@/components/ui/FlowTip'
import { Layers, BookOpen, CalendarCheck, CheckCircle2, PlusCircle, Inbox, Search, ArrowRight } from 'lucide-react'
import { canonicalizeLanguageCode, languageDisplayName, primaryLanguageSubtag } from '@/lib/studyLanguages'
import { FormType } from '@/types'
import {
  localDayBounds,
  requestDashboard,
} from '@/lib/dashboard/dashboardClient'
import type { DashboardResponse } from '@/lib/dashboard/dashboardDto'

interface DashboardContentProps {
  navigate: (href: string) => void
}

export default function DashboardPage() {
  const router = useRouter()

  return <DashboardContent navigate={href => router.push(href)} />
}

export function DashboardContent({ navigate }: DashboardContentProps) {
  const { user, loading: authLoading } = useAuth()
  const uid = user?.uid
  const {
    languages,
    enabledLanguages,
    loading: languagesLoading,
  } = useStudyLanguages()
  const languageCodesKey = enabledLanguages
    .flatMap(language => canonicalizeLanguageCode(language.code) ?? [])
    .join(',')
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (authLoading || languagesLoading || !uid) return

    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller

    Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return undefined
        setDashboard(null)
        setLoading(true)
        const languageCodes = languageCodesKey ? languageCodesKey.split(',') : []
        return requestDashboard(localDayBounds(), languageCodes, controller.signal)
      })
      .then(response => {
        if (!response || requestRef.current !== controller || controller.signal.aborted) {
          return
        }
        setDashboard(response)
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          console.error('Error fetching dashboard:', error)
        }
      })
      .finally(() => {
        if (requestRef.current === controller) {
          requestRef.current = null
          setLoading(false)
        }
      })

    return () => {
      controller.abort()
      if (requestRef.current === controller) requestRef.current = null
    }
  }, [authLoading, languageCodesKey, languagesLoading, uid])

  const stats = dashboard?.stats
  const successRate = stats && stats.total_vocabulary > 0
    ? Math.round((stats.synced / stats.total_vocabulary) * 100)
    : 0

  const languageBreakdown = useMemo(() => {
    const counts = (dashboard?.language_counts ?? []).filter(item => item.count > 0)
    const total = counts.reduce((sum, item) => sum + item.count, 0) || 1
    return counts
      .map(({ language, count }) => ({
        lang: language,
        label: languageDisplayName(language, languages),
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
  }, [dashboard?.language_counts, languages])

  const recentEntries = dashboard?.recent_entries ?? []

  return (
    <MotionPage>
      <PageHeader
        title="Dashboard"
        description="A snapshot of your vocabulary library."
        actions={
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                aria-label="Search cards"
                placeholder="Search cards…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-[160px] sm:w-[200px] h-[38px] pl-9 pr-10 bg-white border border-border rounded-[9px] text-sm text-ink placeholder:text-slate-400/60 focus:border-primary focus:ring-[3px] focus:ring-primary-bg focus:outline-none"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-400 border border-border rounded px-1.5 py-0.5">/</kbd>
            </div>
            <Button variant="primary" leftIcon={<PlusCircle className="w-4 h-4" />} onClick={() => navigate('/create')}>
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
            value={loading ? '—' : stats?.total_vocabulary ?? 0}
            icon={<BookOpen className="w-5 h-5" />}
          />
          <StatCard
            label="Cards"
            value={loading ? '—' : stats?.total_cards ?? 0}
            icon={<Layers className="w-5 h-5" />}
          />
          <StatCard
            label="Today"
            value={loading ? '—' : stats?.created_today ?? 0}
            icon={<CalendarCheck className="w-5 h-5" />}
          />
          <StatCard
            label="Synced"
            value={loading ? '—' : `${successRate}%`}
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
                onClick={() => navigate('/history')}
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
                action={<Button variant="primary" size="sm" onClick={() => navigate('/create')}>Create a card</Button>}
              />
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {recentEntries.map(entry => {
                  const word = entry.word || entry.term || entry.title || '—'
                  const meaning = entry.meaning_vi || entry.definition || entry.content || '—'
                  const isSynced = entry.status === 'synced'
                  const langCode = entry.form_type === FormType.LANGUAGE && entry.language
                    ? primaryLanguageSubtag(entry.language)?.toUpperCase() ?? entry.language.toUpperCase()
                    : null
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => navigate(`/history/${entry.id}`)}
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
                        <div className={`h-full rounded-full transition-all duration-500 ${primaryLanguageSubtag(lang) === 'ja' ? 'bg-amber' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
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

    </MotionPage>
  )
}
