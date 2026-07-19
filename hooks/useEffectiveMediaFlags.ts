'use client'

import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/components/providers/AuthProvider'
import { useGlobalConfig } from '@/components/providers/GlobalConfigProvider'

/**
 * "上限モデル" (effective = global AND user): admin が機能を無効化 → 個人設定に関わらず
 * 誰も使えない; admin が再有効化 → 各 user は元の個人設定に戻る
 * (2 つの値は別々の Firestore doc にあるため、admin に上書きされない)。
 */
export function useEffectiveMediaFlags(): { effectiveTts: boolean; effectiveUnsplash: boolean; loading: boolean } {
  const { user, loading: authLoading } = useAuth()
  const { config, loading: globalLoading } = useGlobalConfig()
  const [userPrefs, setUserPrefs] = useState<{ tts_enabled: boolean; unsplash_enabled: boolean }>({
    tts_enabled: true,
    unsplash_enabled: true,
  })
  const [prefsLoading, setPrefsLoading] = useState(true)

  useEffect(() => {
    if (authLoading || !user) return
    let cancelled = false
    getDoc(doc(db, 'settings', user.uid))
      .then((snap) => {
        if (cancelled) return
        if (snap.exists()) {
          const data = snap.data() as Partial<{ tts_enabled: boolean; unsplash_enabled: boolean }>
          setUserPrefs({
            tts_enabled: data.tts_enabled ?? true,
            unsplash_enabled: data.unsplash_enabled ?? true,
          })
        }
      })
      .catch(() => {
        /* fail-open — 既定の true を維持 */
      })
      .finally(() => {
        if (!cancelled) setPrefsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, authLoading])

  return {
    effectiveTts: config.tts_available && userPrefs.tts_enabled,
    effectiveUnsplash: config.unsplash_available && userPrefs.unsplash_enabled,
    loading: authLoading || globalLoading || prefsLoading,
  }
}
