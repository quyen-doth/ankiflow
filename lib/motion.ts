/**
 * motion.ts
 * Preset animation dùng chung cho toàn app (framer-motion) — phong cách tinh tế,
 * chuyên nghiệp: nhanh (150–280ms), fade + scale/translate nhẹ. Tôn trọng reduced-motion
 * thông qua <MotionConfig reducedMotion="user"> ở MotionProvider.
 */

import type { Variants, Transition } from 'framer-motion'

/** Thời lượng (giây). */
export const DUR = { fast: 0.15, base: 0.2, slow: 0.28 } as const

/** easeOutExpo — vào nhanh, dừng êm. */
export const EASE = [0.16, 1, 0.3, 1] as const

export const baseTransition: Transition = { duration: DUR.base, ease: EASE }

/** Fade đơn giản. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: baseTransition },
  exit: { opacity: 0, transition: { duration: DUR.fast, ease: EASE } },
}

/** Fade + trượt lên nhẹ (8px). Dùng cho item danh sách / nội dung trang. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: baseTransition },
  exit: { opacity: 0, y: 8, transition: { duration: DUR.fast, ease: EASE } },
}

/** Lớp phủ mờ (overlay) cho modal. */
export const overlayFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.fast, ease: EASE } },
  exit: { opacity: 0, transition: { duration: DUR.fast, ease: EASE } },
}

/** Panel modal: scale nhẹ 0.97→1 + trượt lên 8px. */
export const scaleModal: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 8 },
  show: { opacity: 1, scale: 1, y: 0, transition: baseTransition },
  exit: { opacity: 0, scale: 0.98, y: 6, transition: { duration: DUR.fast, ease: EASE } },
}

/** Panel dropdown: fade + trượt 4px, mở từ phía trên. */
export const dropdownPanel: Variants = {
  hidden: { opacity: 0, y: -4, scale: 0.99 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: DUR.fast, ease: EASE } },
  exit: { opacity: 0, y: -4, scale: 0.99, transition: { duration: 0.12, ease: EASE } },
}

/** Toast: trượt từ phải + fade. */
export const toastItem: Variants = {
  hidden: { opacity: 0, x: 24, scale: 0.98 },
  show: { opacity: 1, x: 0, scale: 1, transition: baseTransition },
  exit: { opacity: 0, x: 24, scale: 0.98, transition: { duration: DUR.fast, ease: EASE } },
}

/** Container so le cho danh sách. */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
}

/** Item con của staggerContainer. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: baseTransition },
}
