import { createElement } from 'react'
import { beforeEach, vi } from 'vitest'
import { MotionGlobalConfig } from 'framer-motion'
import { TEST_AUTH_USER } from '@/verify/core/test-auth-user'

// --- framer-motion chạy tức thì trong test (AnimatePresence gỡ DOM ngay khi exit) ---
// để các verify spec kiểm sự hiện diện/biến mất của DOM không bị animation làm trễ.
MotionGlobalConfig.skipAnimations = true

// --- TEST_AUTH_USER (runner.ts) coi như admin trong mọi spec — components admin-gated
// (ContentTypeManager...) test được CRUD UI thật, không bị chặn
// bởi gate. Muốn test riêng nhánh non-admin thì cần cơ chế mock user khác (chưa có).
process.env.NEXT_PUBLIC_ADMIN_EMAIL = TEST_AUTH_USER.email

// --- Mock next/navigation cho toàn bộ test ---
// Specs đọc/ghi trạng thái qua globalThis.__verifyNav (xem verify/core/globals.ts)
const nav = {
  pathname: '/',
  calls: [] as Array<{ method: string; args: unknown[] }>,
}
;(globalThis as unknown as { __verifyNav: typeof nav }).__verifyNav = nav

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({
    push: (...args: unknown[]) => nav.calls.push({ method: 'push', args }),
    replace: (...args: unknown[]) => nav.calls.push({ method: 'replace', args }),
    back: () => nav.calls.push({ method: 'back', args: [] }),
    forward: () => nav.calls.push({ method: 'forward', args: [] }),
    refresh: () => nav.calls.push({ method: 'refresh', args: [] }),
    prefetch: () => Promise.resolve(),
  }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error('notFound() called')
  },
}))

// --- Mock next/image → <img> thuần (jsdom không cần Next image optimizer) ---
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, className } = props
    return createElement('img', {
      src: typeof src === 'string' ? src : '',
      alt: typeof alt === 'string' ? alt : '',
      className: typeof className === 'string' ? className : undefined,
    })
  },
}))

// --- Stub HTMLMediaElement cho AudioPlayer (jsdom không implement play()) ---
class AudioStub {
  src: string
  constructor(src = '') {
    this.src = src
    audioInstances.push(this)
  }
  play(): Promise<void> {
    return Promise.resolve()
  }
  pause(): void {}
}
const audioInstances: AudioStub[] = []
;(globalThis as unknown as { Audio: typeof AudioStub; __verifyAudioInstances: AudioStub[] }).Audio = AudioStub
;(globalThis as unknown as { __verifyAudioInstances: AudioStub[] }).__verifyAudioInstances = audioInstances

beforeEach(() => {
  localStorage.clear()
  nav.pathname = '/'
  nav.calls.length = 0
  audioInstances.length = 0
})
