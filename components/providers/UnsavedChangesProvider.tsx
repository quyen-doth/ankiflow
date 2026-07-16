'use client'

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

type NavigationAction = () => void | Promise<void>

interface PendingNavigation {
  action: NavigationAction
}

interface UnsavedChangesContextValue {
  setDirty: (source: symbol, dirty: boolean) => void
  requestNavigation: (action: NavigationAction) => void
}

export const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null)

function isPlainNavigationClick(event: MouseEvent): boolean {
  return event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
}

function navigationTarget(event: MouseEvent): HTMLAnchorElement | null {
  if (!(event.target instanceof Element)) return null
  const anchor = event.target.closest<HTMLAnchorElement>('a[href]')
  if (!anchor || anchor.download) return null
  if (anchor.target && anchor.target !== '_self') return null
  return anchor
}

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [dirtySources, setDirtySources] = useState<Set<symbol>>(() => new Set())
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null)
  const bypassRef = useRef(false)
  const guardedUrlRef = useRef('')
  const guardedHistoryStateRef = useRef<unknown>(null)
  const isDirty = dirtySources.size > 0

  const setDirty = useCallback((source: symbol, dirty: boolean) => {
    setDirtySources(current => {
      const next = new Set(current)
      if (dirty) next.add(source)
      else next.delete(source)
      return next
    })
  }, [])

  const requestNavigation = useCallback((action: NavigationAction) => {
    if (!isDirty || bypassRef.current) {
      void action()
      return
    }
    setPendingNavigation({ action })
  }, [isDirty])

  const keepEditing = useCallback(() => {
    setPendingNavigation(null)
  }, [])

  const discardChanges = useCallback(() => {
    const action = pendingNavigation?.action
    if (!action) return
    bypassRef.current = true
    setPendingNavigation(null)
    setDirtySources(new Set())
    void action()
  }, [pendingNavigation])

  useEffect(() => {
    if (!isDirty) {
      bypassRef.current = false
      return
    }

    guardedUrlRef.current = window.location.href
    guardedHistoryStateRef.current = window.history.state
  }, [isDirty])

  useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (bypassRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (bypassRef.current || event.defaultPrevented || !isPlainNavigationClick(event)) return
      const anchor = navigationTarget(event)
      if (!anchor) return

      const currentUrl = new URL(window.location.href)
      const targetUrl = new URL(anchor.href, currentUrl)
      const sameDocument = targetUrl.origin === currentUrl.origin
        && targetUrl.pathname === currentUrl.pathname
        && targetUrl.search === currentUrl.search
      if (sameDocument) return

      event.preventDefault()
      event.stopPropagation()
      requestNavigation(() => window.location.assign(targetUrl.href))
    }

    const handlePopState = (event: PopStateEvent) => {
      if (bypassRef.current || window.location.href === guardedUrlRef.current) return
      const targetUrl = window.location.href
      event.stopImmediatePropagation()
      window.history.pushState(
        guardedHistoryStateRef.current,
        '',
        guardedUrlRef.current,
      )
      requestNavigation(() => window.location.assign(targetUrl))
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleDocumentClick, true)
    window.addEventListener('popstate', handlePopState, true)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleDocumentClick, true)
      window.removeEventListener('popstate', handlePopState, true)
    }
  }, [isDirty, requestNavigation])

  const value = useMemo<UnsavedChangesContextValue>(() => ({
    setDirty,
    requestNavigation,
  }), [requestNavigation, setDirty])

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <Modal
        open={pendingNavigation !== null}
        onClose={keepEditing}
        title="Unsaved changes"
        description="You have changes that haven't been saved. Leave without saving?"
        size="sm"
      >
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={keepEditing}>
            Keep editing
          </Button>
          <Button variant="destructive" onClick={discardChanges}>
            Discard changes
          </Button>
        </div>
      </Modal>
    </UnsavedChangesContext.Provider>
  )
}
