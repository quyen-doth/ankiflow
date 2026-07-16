import type { ReactElement } from 'react'
import type { ZodType } from 'zod'

/** Kết quả chấm cho một fixture: BLOCKED > FAIL > SKIP > PASS */
export type Verdict = 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIP'

export type CheckStatus = 'ok' | 'fail' | 'warn' | 'skip'

/** Một kết quả kiểm tra đơn lẻ do verifier trả về */
export interface Check {
  verifier: string
  status: CheckStatus
  label: string
  detail?: string
}

/** Context truyền cho fixture.act() — driver tương tác với DOM đã mount */
export interface ActContext {
  root: HTMLElement
  click: (selector: string) => Promise<void>
  type: (selector: string, text: string) => Promise<void>
  wait: (ms: number) => Promise<void>
}

/** Quy tắc mock cho một request fetch */
export interface FetchRule {
  match: string | RegExp
  response: {
    status?: number
    json?: unknown
    delayMs?: number
    /** Giả lập lỗi mạng (fetch reject) thay vì trả response */
    reject?: boolean
  }
}

export interface DocSeed {
  id: string
  [field: string]: unknown
}

/**
 * Mocks extension (không có trong framework gốc): môi trường giả lập
 * được runner cài đặt trước khi mount và khôi phục sau khi verify.
 * `firestore` chỉ hoạt động trong vitest (module alias) — trên browser
 * dashboard, fixture có `firestore` sẽ trả verdict SKIP.
 */
export interface FixtureMocks {
  fetch?: FetchRule[]
  firestore?: Record<string, DocSeed[]>
  localStorage?: Record<string, string>
  /** Auth context cho fixture; mặc định dùng TEST_AUTH_USER. */
  auth?: {
    user: { uid: string; email: string | null } | null
    loading?: boolean
  }
  /** Pathname cho mock next/navigation (chỉ có tác dụng trong vitest) */
  pathname?: string
}

/** Một cấu hình render tái lập được của unit */
export interface Fixture<P = unknown> {
  id: string
  description: string
  props: P
  /** Fixture đối kháng / stress test — mỗi unit phải có ít nhất một probe */
  probe?: boolean
  act?: (ctx: ActContext) => void | Promise<void>
  mocks?: FixtureMocks
}

export interface InvariantContext<P = unknown> {
  root: HTMLElement
  props: P
  fixture: Fixture<P>
  contract: Record<string, string>
}

/** Predicate phải đúng trên DOM đã mount; trả true hoặc string mô tả vi phạm */
export interface Invariant<P = unknown> {
  id: string
  description: string
  onlyFixtures?: string[]
  check: (ctx: InvariantContext<P>) => boolean | string
}

export interface VerifiableUnit<P = unknown> {
  id: string
  title: string
  description?: string
  kind: 'component' | 'feature'
  render: (props: P) => ReactElement
  propsSchema?: ZodType
  fixtures: Fixture<P>[]
  invariants: Invariant<P>[]
  /** Giới hạn verifier nào chạy cho unit này (mặc định: tất cả) */
  verifiers?: string[]
  /**
   * Unit có thể render null hợp lệ (Modal đóng, ErrorMessage null) —
   * dom-contract verifier SKIP thay vì FAIL khi DOM rỗng.
   */
  allowsEmptyRender?: boolean
}

export interface VerifierContext {
  unit: VerifiableUnit
  fixture: Fixture
  root: HTMLElement
  contract: Record<string, string>
}

export interface Verifier {
  id: string
  description: string
  run: (ctx: VerifierContext) => Check[] | Promise<Check[]>
}

export interface VerifyResult {
  unitId: string
  fixtureId: string
  verdict: Verdict
  checks: Check[]
  domSnapshot: Record<string, string>
  durationMs: number
  blockedReason?: string
  skipReason?: string
  timestamp: string
}

export interface ManifestEntry {
  unitId: string
  title: string
  kind: 'component' | 'feature'
  fixtures: Array<{ id: string; description: string; probe: boolean }>
  verifiers: string[]
}

/** API gắn vào window.__verify cho agent điều khiển từ browser console */
export interface VerifyHandle {
  version: string
  manifest: () => ManifestEntry[]
  current: () => VerifyResult | null
  runAll: () => Promise<VerifyResult[]>
}
