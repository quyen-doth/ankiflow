'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { GLOBAL_SETTINGS_DOC_ID } from '@/lib/constants'
import type { GlobalSettings } from '@/types'

type GlobalConfigValue = Pick<
  GlobalSettings,
  | 'ai_model'
  | 'web_search_enabled'
  | 'tts_available'
  | 'unsplash_available'
  | 'line_notifications_available'
  | 'line_schedule_hours'
  | 'line_words_per_notification'
>

/** Fail-open: doc が未作成 (seed 未実行) でも全機能を利用可能にする。 */
const DEFAULT_CONFIG: GlobalConfigValue = {
  ai_model: 'claude-haiku-4-5',
  web_search_enabled: false,
  tts_available: true,
  unsplash_available: true,
  line_notifications_available: true,
  line_schedule_hours: [],
  line_words_per_notification: 5,
}

interface GlobalConfigContextValue {
  config: GlobalConfigValue
  loading: boolean
}

const GlobalConfigContext = createContext<GlobalConfigContextValue>({ config: DEFAULT_CONFIG, loading: true })

/**
 * admin が管理するグローバル feature flags (`settings/global`) — realtime (onSnapshot) で
 * admin の on/off が開いている全タブへ reload なしで即反映される。
 * secrets は含まない — ログイン済み user が client SDK で読んでも安全。
 */
export function GlobalConfigProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [config, setConfig] = useState<GlobalConfigValue>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onSnapshot(
      doc(db, 'settings', GLOBAL_SETTINGS_DOC_ID),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<GlobalConfigValue>
          setConfig({
            ai_model: data.ai_model ?? DEFAULT_CONFIG.ai_model,
            web_search_enabled: data.web_search_enabled ?? DEFAULT_CONFIG.web_search_enabled,
            tts_available: data.tts_available ?? DEFAULT_CONFIG.tts_available,
            unsplash_available: data.unsplash_available ?? DEFAULT_CONFIG.unsplash_available,
            line_notifications_available:
              data.line_notifications_available ?? DEFAULT_CONFIG.line_notifications_available,
            line_schedule_hours: data.line_schedule_hours ?? DEFAULT_CONFIG.line_schedule_hours,
            line_words_per_notification:
              data.line_words_per_notification ?? DEFAULT_CONFIG.line_words_per_notification,
          })
        }
        setLoading(false)
      },
      () => setLoading(false),
    )
    return unsubscribe
  }, [])

  return <GlobalConfigContext.Provider value={{ config, loading }}>{children}</GlobalConfigContext.Provider>
}

export function useGlobalConfig(): GlobalConfigContextValue {
  return useContext(GlobalConfigContext)
}
