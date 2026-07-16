'use client'

import { useContext, useEffect, useRef } from 'react'
import { UnsavedChangesContext } from '@/components/providers/UnsavedChangesProvider'

function useUnsavedChangesContext() {
  const context = useContext(UnsavedChangesContext)
  if (!context) {
    throw new Error('Unsaved changes hooks must be used within UnsavedChangesProvider')
  }
  return context
}

export function useUnsavedChangesGuard(isDirty: boolean) {
  const { setDirty } = useUnsavedChangesContext()
  const sourceRef = useRef(Symbol('unsaved-changes'))

  useEffect(() => {
    const source = sourceRef.current
    setDirty(source, isDirty)
    return () => setDirty(source, false)
  }, [isDirty, setDirty])
}

export function useConfirmNavigation() {
  return useUnsavedChangesContext().requestNavigation
}
