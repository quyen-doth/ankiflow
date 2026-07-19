'use client'

import { MotionConfig } from 'framer-motion'

/** アプリを MotionConfig で包む — user が prefers-reduced-motion を有効にすると animation を自動停止。 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
