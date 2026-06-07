'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { PageHeader } from '@/components/layout/PageHeader'
import { WordDetailCard } from '@/components/history/WordDetailCard'
import { CardPreview } from '@/components/preview/CardPreview'
import type { Entry } from '@/types'

export default function HistoryDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [entry, setEntry] = useState<Entry | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchEntry() {
      if (!id) return
      try {
        const docRef = doc(db, 'entries', id)
        const docSnap = await getDoc(docRef)
        
        if (docSnap.exists()) {
          setEntry({ id: docSnap.id, ...docSnap.data() } as Entry)
        } else {
          console.error('Entry not found')
        }
      } catch (error) {
        console.error('Failed to fetch entry detail:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchEntry()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-xl font-bold text-on-surface mb-2">Card not found</p>
          <p className="text-on-surface-var">This card may have been deleted or doesn&apos;t exist.</p>
        </div>
      </div>
    )
  }

  const wordLabel = entry.word || entry.term || entry.title || 'Card details'

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'History', href: '/history' },
          { label: wordLabel }
        ]}
      />

      {/* Layout 8:4 Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto pb-12">
        {/* Cột trái (8): Chi tiết thẻ */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <WordDetailCard entry={entry} />
        </div>

        {/* Cột phải (4): Preview */}
        <div className="lg:col-span-4">
          <div className="sticky top-8 flex flex-col gap-4">
            <div className="bg-white rounded-xl shadow-card border border-outline-var/40 p-6 lg:p-8">
              <h2 className="text-label-sm uppercase text-on-surface-var font-bold tracking-wider mb-6">
                Card Preview
              </h2>
              <CardPreview entry={entry} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
