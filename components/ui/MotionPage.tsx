'use client'

import { motion } from 'framer-motion'
import { DUR, EASE } from '@/lib/motion'

/**
 * route 遷移時に滑らかな fade-in をかけるページラッパー。
 * opacity のみ使用 (transform なし) — containing-block を作って内部の
 * `position: sticky` 要素を壊さないため。
 */
export function MotionPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DUR.slow, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}
