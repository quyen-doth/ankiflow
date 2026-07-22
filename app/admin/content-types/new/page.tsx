'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ContentTypeEditorPage } from '@/components/admin/ContentTypeEditorPage'

function NewContentTypeRoute() {
  const searchParams = useSearchParams()
  return (
    <ContentTypeEditorPage
      contentTypeId={null}
      requestedGlobalScope={searchParams.get('scope') === 'global-defaults'}
      fromSettings={searchParams.get('from') === 'settings'}
    />
  )
}

export default function NewContentTypePage() {
  return (
    <Suspense>
      <NewContentTypeRoute />
    </Suspense>
  )
}
