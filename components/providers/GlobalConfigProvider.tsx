'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { GLOBAL_SETTINGS_DOC_ID } from '@/lib/constants'
import type { GlobalSettings } from '@/types'

type GlobalConfigValue = Pick<GlobalSettings, 'ai_model' | 'web_search_enabled' | 'tts_available' | 'unsplash_available'>

/** Fail-open: nếu doc chưa tồn tại (chưa chạy seed) mọi tính năng vẫn khả dụng. */
const DEFAULT_CONFIG: GlobalConfigValue = {
  ai_model: 'claude-haiku-4-5',
  web_search_enabled: false,
  tts_available: true,
  unsplash_available: true,
}

interface GlobalConfigContextValue {
  config: GlobalConfigValue
  loading: boolean
}

const GlobalConfigContext = createContext<GlobalConfigContextValue>({ config: DEFAULT_CONFIG, loading: true })

/**
 * Feature flags toàn cục do admin kiểm soát (`settings/global`) — realtime (onSnapshot)
 * để mọi tab đang mở cập nhật ngay khi admin bật/tắt, không cần reload.
 * KHÔNG chứa secrets — an toàn đọc bằng client SDK cho mọi user đã đăng nhập.
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
