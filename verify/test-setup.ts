import { createElement } from 'react'
import { beforeEach, vi } from 'vitest'

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
