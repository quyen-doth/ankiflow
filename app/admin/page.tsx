'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { CategoryManager } from '@/components/admin/CategoryManager'
import { CardTypeManager } from '@/components/admin/CardTypeManager'
import { TopicManager } from '@/components/admin/TopicManager'
import { DeckManager } from '@/components/admin/DeckManager'
import { ContentTypeManager } from '@/components/admin/ContentTypeManager'
import { NotificationManager } from '@/components/admin/NotificationManager'

const TABS = [
  { id: 'categories', label: 'Categories' },
  { id: 'card-types', label: 'Card Types' },
  { id: 'topics', label: 'Topics' },
  { id: 'decks', label: 'Decks' },
  { id: 'content-types', label: 'Content Types' },
  { id: 'notifications', label: 'Notifications' },
]

const TAB_IDS = TABS.map(t => t.id)

export default function AdminPage() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(TAB_IDS.includes(initialTab ?? '') ? initialTab! : 'categories')

  return (
    <>
      <PageHeader
        title="Admin"
        description="Manage the configuration data that powers the Create flow."
      />

      <div className="max-w-5xl mx-auto w-full pb-12 flex flex-col gap-6">
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} variant="underline" className="self-start" />

        {activeTab === 'categories' && <CategoryManager />}
        {activeTab === 'card-types' && <CardTypeManager />}
        {activeTab === 'topics' && <TopicManager />}
        {activeTab === 'decks' && <DeckManager />}
        {activeTab === 'content-types' && <ContentTypeManager />}
        {activeTab === 'notifications' && <NotificationManager />}
      </div>
    </>
  )
}
