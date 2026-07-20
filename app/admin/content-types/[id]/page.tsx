'use client'

import { Suspense, use } from 'react'
import { useSearchParams } from 'next/navigation'
import { ContentTypeEditorPage } from '@/components/admin/ContentTypeEditorPage'

function EditContentTypeRoute({ id }: { id: string }) {
  const searchParams = useSearchParams()
  return (
    <ContentTypeEditorPage
      contentTypeId={id}
      requestedGlobalScope={searchParams.get('scope') === 'global-defaults'}
      fromSettings={searchParams.get('from') === 'settings'}
    />
  )
}

export default function EditContentTypePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return (
    <Suspense>
      <EditContentTypeRoute id={decodeURIComponent(id)} />
    </Suspense>
  )
}
