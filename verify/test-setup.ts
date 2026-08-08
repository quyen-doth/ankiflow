import { createElement } from 'react'
import { beforeEach, vi } from 'vitest'
import { MotionGlobalConfig } from 'framer-motion'
import { TEST_AUTH_USER } from '@/verify/core/test-auth-user'

// DOMの出入りを待ち時間に依存させないため、animationを即時完了させる。
MotionGlobalConfig.skipAnimations = true

// admin-gated componentも共通fixtureで検証できるよう、既定userをadmin扱いにする。
process.env.NEXT_PUBLIC_ADMIN_EMAIL = TEST_AUTH_USER.email

// route依存specを決定的にするため、navigation状態をglobalで観測可能にする。
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

// jsdomでoptimizerを起動せずalt/srcだけを検証できるよう、素のimgへ置き換える。
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

// jsdomにmedia再生実装がないため、生成srcだけ観測できるstubを使う。
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
