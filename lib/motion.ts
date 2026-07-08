/**
 * motion.ts
 * アプリ全体で共有するアニメーションプリセット (framer-motion) — 洗練された
 * プロフェッショナルなスタイル: 速い (150–280ms)、軽い fade + scale/translate。
 * MotionProvider の <MotionConfig reducedMotion="user"> 経由で reduced-motion を尊重。
 */

import type { Variants, Transition } from 'framer-motion'

/** 継続時間 (秒)。 */
export const DUR = { fast: 0.15, base: 0.2, slow: 0.28 } as const

/** easeOutExpo — 速く入り、なめらかに止まる。 */
export const EASE = [0.16, 1, 0.3, 1] as const

export const baseTransition: Transition = { duration: DUR.base, ease: EASE }

/** シンプルな Fade。 */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: baseTransition },
  exit: { opacity: 0, transition: { duration: DUR.fast, ease: EASE } },
}

/** Fade + 軽く上にスライド (8px)。リストの item / ページコンテンツに使用。 */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: baseTransition },
  exit: { opacity: 0, y: 8, transition: { duration: DUR.fast, ease: EASE } },
}

/** modal 用の半透明レイヤー (overlay)。 */
export const overlayFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: DUR.fast, ease: EASE } },
  exit: { opacity: 0, transition: { duration: DUR.fast, ease: EASE } },
}

/** Panel modal: 軽い scale 0.97→1 + 上に 8px スライド。 */
export const scaleModal: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 8 },
  show: { opacity: 1, scale: 1, y: 0, transition: baseTransition },
  exit: { opacity: 0, scale: 0.98, y: 6, transition: { duration: DUR.fast, ease: EASE } },
}

/** Panel dropdown: fade + 4px スライド、上から開く。 */
export const dropdownPanel: Variants = {
  hidden: { opacity: 0, y: -4, scale: 0.99 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: DUR.fast, ease: EASE } },
  exit: { opacity: 0, y: -4, scale: 0.99, transition: { duration: 0.12, ease: EASE } },
}

/** Toast: 右からスライド + fade。 */
export const toastItem: Variants = {
  hidden: { opacity: 0, x: 24, scale: 0.98 },
  show: { opacity: 1, x: 0, scale: 1, transition: baseTransition },
  exit: { opacity: 0, x: 24, scale: 0.98, transition: { duration: DUR.fast, ease: EASE } },
}

/** リスト用の時差付き Container。 */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
}

/** staggerContainer の子 Item。 */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: baseTransition },
}
