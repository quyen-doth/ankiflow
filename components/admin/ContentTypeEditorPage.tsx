'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/layout/PageHeader'
import { ContentTypeEditor, type ContentTypeEditorScope } from '@/components/admin/ContentTypeEditor'
import { useAuth } from '@/components/providers/AuthProvider'
import { useUnsavedChangesGuard, useConfirmNavigation } from '@/hooks/useUnsavedChangesGuard'
import { verifyAttrs } from '@/verify/core/contract'
import {
  GLOBAL_CONTENT_TYPES_COLLECTION,
  USER_CONTENT_TYPES_COLLECTION,
} from '@/lib/constants'
import type { ContentType } from '@/types'

type LoadState = 'loading' | 'ready' | 'not-found' | 'forbidden'

interface ContentTypeEditorPageProps {
  /** null → 新規作成ページ。 */
  contentTypeId: string | null
  /** `?scope=global-defaults` — admin でなければ拒否する。 */
  requestedGlobalScope?: boolean
  /** `?from=settings` — 戻り先と breadcrumb を切り替える。 */
  fromSettings?: boolean
}

/**
 * Route が自分で document を取得する (list component は既に unmount 済みで渡せない)。
 * 所有権と scope はここで検証する — Firestore rules と同じ判断をクライアント側にも出す。
 */
export function ContentTypeEditorPage({
  contentTypeId,
  requestedGlobalScope = false,
  fromSettings = false,
}: ContentTypeEditorPageProps) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const uid = user?.uid
  const isAdmin = !!user?.email && user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL

  const isGlobalScope = requestedGlobalScope && isAdmin
  const scope: ContentTypeEditorScope = isGlobalScope ? 'global-defaults' : 'workspace'
  const collectionName = isGlobalScope
    ? GLOBAL_CONTENT_TYPES_COLLECTION
    : USER_CONTENT_TYPES_COLLECTION

  const [state, setState] = useState<LoadState>(contentTypeId ? 'loading' : 'ready')
  const [contentType, setContentType] = useState<ContentType | null>(null)
  const [existingCodes, setExistingCodes] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)

  useUnsavedChangesGuard(dirty)
  const confirmNavigation = useConfirmNavigation()

  const listHref = fromSettings
    ? '/settings?tab=content-types'
    : `/admin?tab=content-types${isGlobalScope ? '&scope=global-defaults' : ''}`

  useEffect(() => {
    if (authLoading || !uid) return
    let cancelled = false

    async function load() {
      // Admin 以外が defaults scope を要求した場合は編集させない。
      if (requestedGlobalScope && !isAdmin) {
        if (!cancelled) setState('forbidden')
        return
      }

      try {
        if (!contentTypeId) {
          // 新規作成は code 重複チェックのため既存 code だけ読む。
          const source = collection(db, collectionName)
          const snapshot = await getDocs(
            isGlobalScope ? query(source) : query(source, where('user_id', '==', uid)),
          )
          if (cancelled) return
          setExistingCodes(snapshot.docs.map(document => String(document.data().code ?? '')))
          setState('ready')
          return
        }

        const snapshot = await getDoc(doc(db, collectionName, contentTypeId))
        if (cancelled) return
        if (!snapshot.exists()) {
          setState('not-found')
          return
        }
        const data = { id: snapshot.id, ...snapshot.data() } as ContentType & { user_id?: string }
        // 他ユーザーの document は存在自体を伏せて not-found として扱う。
        if (!isGlobalScope && data.user_id !== uid) {
          setState('not-found')
          return
        }
        setContentType(data)
        setState('ready')
      } catch (error) {
        if (cancelled) return
        console.error('Error loading content type:', error)
        setState('not-found')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [authLoading, uid, isAdmin, contentTypeId, collectionName, isGlobalScope, requestedGlobalScope])

  const handleDirtyChange = useCallback((next: boolean) => setDirty(next), [])

  const leave = useCallback(() => {
    router.push(listHref)
  }, [router, listHref])

  const handleCancel = useCallback(() => {
    confirmNavigation(leave)
  }, [confirmNavigation, leave])

  const title = contentTypeId
    ? contentType ? `Edit — ${contentType.name}` : 'Edit Content Type'
    : 'New Content Type'

  return (
    <>
      <PageHeader
        title={title}
        description={
          isGlobalScope
            ? 'Editing the defaults new accounts receive on sign-up.'
            : 'Form configuration and AI output profiles for your workspace.'
        }
      />

      <div
        className="max-w-6xl mx-auto w-full pb-12 flex flex-col gap-4"
        {...verifyAttrs({
          unit: 'ContentTypeEditorPage',
          state,
          scope,
          mode: contentTypeId ? 'edit' : 'create',
        })}
      >
        <nav aria-label="Breadcrumb" className="text-[12.5px] text-slate-500">
          <button
            type="button"
            onClick={handleCancel}
            className="underline underline-offset-2 hover:text-ink"
          >
            {fromSettings ? 'Settings' : 'Admin'} / Content Types
          </button>
          <span className="mx-1">/</span>
          <span className="text-ink">{contentType?.name ?? 'New'}</span>
        </nav>

        {state === 'loading' && (
          <Card><p className="text-sm text-slate-600 py-6 text-center">Loading content type...</p></Card>
        )}

        {state === 'forbidden' && (
          <Card>
            <p className="text-sm text-slate-600 py-6 text-center">
              Editing new-user defaults requires an admin account.
            </p>
            <div className="flex justify-center pb-4">
              <Button variant="secondary" onClick={leave}>Back to Content Types</Button>
            </div>
          </Card>
        )}

        {state === 'not-found' && (
          <Card>
            <p className="text-sm text-slate-600 py-6 text-center">
              This content type no longer exists, or it belongs to another workspace.
            </p>
            <div className="flex justify-center pb-4">
              <Button variant="secondary" onClick={leave}>Back to Content Types</Button>
            </div>
          </Card>
        )}

        {state === 'ready' && (
          <Card className="px-4 sm:px-6">
            <ContentTypeEditor
              contentType={contentType}
              scope={scope}
              existingCodes={existingCodes}
              layout="page"
              onDirtyChange={handleDirtyChange}
              onSaved={leave}
              onCancel={handleCancel}
            />
          </Card>
        )}
      </div>
    </>
  )
}
