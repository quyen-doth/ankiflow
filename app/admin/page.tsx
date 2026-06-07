'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tabs } from '@/components/ui/Tabs'
import { CategoryManager } from '@/components/admin/CategoryManager'
import { CardTypeManager } from '@/components/admin/CardTypeManager'
import { TopicManager } from '@/components/admin/TopicManager'
import { DeckManager } from '@/components/admin/DeckManager'
import { ContentTypeManager } from '@/components/admin/ContentTypeManager'

const TABS = [
  { id: 'categories', label: 'Categories' },
  { id: 'card-types', label: 'Card Types' },
  { id: 'topics', label: 'Topics' },
  { id: 'decks', label: 'Decks' },
  { id: 'content-types', label: 'Content Types' },
]

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('categories')

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin' }]}
        title="Admin"
        description="Manage the configuration data that powers the Create flow"
      />

      <div className="max-w-5xl mx-auto w-full pb-12 flex flex-col gap-6">
        <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} className="self-start" />

        {activeTab === 'categories' && <CategoryManager />}
        {activeTab === 'card-types' && <CardTypeManager />}
        {activeTab === 'topics' && <TopicManager />}
        {activeTab === 'decks' && <DeckManager />}
        {activeTab === 'content-types' && <ContentTypeManager />}
      </div>
    </>
  )
}
