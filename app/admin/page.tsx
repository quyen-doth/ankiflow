'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { CategoryManager } from '@/components/admin/CategoryManager'
import { CardTypeManager } from '@/components/admin/CardTypeManager'
import { TopicManager } from '@/components/admin/TopicManager'
import { DeckManager } from '@/components/admin/DeckManager'
import { ContentTypeManager } from '@/components/admin/ContentTypeManager'
import { NotificationManager } from '@/components/admin/NotificationManager'
import { useAuth } from '@/components/providers/AuthProvider'
import { DEFAULTS_OWNER_ID } from '@/lib/constants'
import { cn } from '@/lib/utils'

const TABS = [
  { id: 'categories', label: 'Categories' },
  { id: 'card-types', label: 'Card Types' },
  { id: 'topics', label: 'Topics' },
  { id: 'decks', label: 'Decks' },
  { id: 'content-types', label: 'Content Types' },
  { id: 'notifications', label: 'Notifications' },
]

const TAB_IDS = TABS.map(t => t.id)

// Chỉ 4 tab này có bản per-user + template ("New-user defaults"). content-types là
// SHARED (routing cốt lõi) và notifications là admin-only sẵn — không có ownerId.
const OWNER_SCOPED_TABS = new Set(['categories', 'card-types', 'topics', 'decks'])

/** Switch "My workspace" / "New-user defaults" — chỉ admin thấy, chỉ áp dụng cho 4 tab per-user. */
function OwnerScopeSwitch({ templateMode, onChange }: { templateMode: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="inline-flex gap-1 bg-[#ececea] rounded-[11px] p-1 self-start" role="radiogroup" aria-label="Editing scope">
      {[
        { value: false, label: 'My workspace' },
        { value: true, label: 'New-user defaults' },
      ].map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          role="radio"
          aria-checked={templateMode === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-4 py-[7px] rounded-[8px] text-[13px] font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
            templateMode === opt.value
              ? 'bg-white text-primary shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
              : 'bg-transparent text-[#7c7f87] hover:text-ink',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function AdminContent() {
  const { user } = useAuth()
  const isAdmin = !!user?.email && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(TAB_IDS.includes(initialTab ?? '') ? initialTab! : 'categories')
  const [templateMode, setTemplateMode] = useState(false)

  // ownerId=undefined → mỗi manager tự dùng uid của user hiện tại (hành vi mặc định).
  const ownerId = isAdmin && templateMode ? DEFAULTS_OWNER_ID : undefined

  return (
    <div className="max-w-5xl mx-auto w-full pb-12 flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} variant="underline" className="self-start" />
        {isAdmin && OWNER_SCOPED_TABS.has(activeTab) && (
          <OwnerScopeSwitch templateMode={templateMode} onChange={setTemplateMode} />
        )}
      </div>

      {isAdmin && templateMode && OWNER_SCOPED_TABS.has(activeTab) && (
        <p className="text-[12.5px] text-slate-600 bg-[#fdfbf5] border border-[#f0e4cc] rounded-[9px] px-3 py-2 -mt-2">
          Editing the defaults new accounts receive on sign-up. Existing users who already customized this are
          not affected.
        </p>
      )}

      {activeTab === 'categories' && <CategoryManager ownerId={ownerId} />}
      {activeTab === 'card-types' && <CardTypeManager ownerId={ownerId} />}
      {activeTab === 'topics' && <TopicManager ownerId={ownerId} />}
      {activeTab === 'decks' && <DeckManager ownerId={ownerId} />}
      {activeTab === 'content-types' && <ContentTypeManager />}
      {activeTab === 'notifications' && <NotificationManager />}
    </div>
  )
}

export default function AdminPage() {
  return (
    <>
      <PageHeader
        title="Admin"
        description="Manage the configuration data that powers the Create flow."
      />

      <Suspense>
        <AdminContent />
      </Suspense>
    </>
  )
}
