'use client'

import { motion } from 'framer-motion'
import { DUR, EASE } from '@/lib/motion'

/**
 * Bọc nội dung trang để fade-in mượt khi vào route.
 * Chỉ dùng opacity (không transform) để không tạo containing-block làm hỏng
 * các phần tử `position: sticky` bên trong.
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
