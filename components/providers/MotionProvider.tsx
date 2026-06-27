'use client'

import { MotionConfig } from 'framer-motion'

/** Bọc app trong MotionConfig — tự tắt animation khi người dùng bật prefers-reduced-motion. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
