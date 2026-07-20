import type { ReactElement } from 'react'
import type { ZodType } from 'zod'

/** fixture の判定結果: BLOCKED > FAIL > SKIP > PASS */
export type Verdict = 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIP'

export type CheckStatus = 'ok' | 'fail' | 'warn' | 'skip'

/** verifier が返す単一の検証結果 */
export interface Check {
  verifier: string
  status: CheckStatus
  label: string
  detail?: string
}

/** fixture.act() に渡す context — driver は mounted DOM と対話する */
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
    /** response を返さず network error (fetch reject) を模擬する */
    reject?: boolean
  }
}

export interface DocSeed {
  id: string
  [field: string]: unknown
}

/**
 * 検証用コメント。
 * 検証用コメント。
 * 検証用コメント。
 * 検証用コメント。
 */
export interface FixtureMocks {
  fetch?: FetchRule[]
  firestore?: Record<string, DocSeed[]>
  localStorage?: Record<string, string>
  /** fixture 用 auth context。default は TEST_AUTH_USER。 */
  auth?: {
    user: { uid: string; email: string | null } | null
    loading?: boolean
  }
  /** mock next/navigation 用 pathname (vitest 内のみ有効) */
  pathname?: string
}

/** unit の再現可能な render 設定 */
export interface Fixture<P = unknown> {
  id: string
  description: string
  props: P
  /** 対抗 / stress test fixture — 各 unit は probe を 1 つ以上持つ必要がある */
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

/** mounted DOM 上で満たすべき predicate。true または違反内容の string を返す */
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
  /** この unit で実行する verifier を制限する (default: すべて) */
  verifiers?: string[]
  /**
   * 検証用コメント。
   * 検証用コメント。
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

/** agent が browser console から操作するために window.__verify へ公開する API */
export interface VerifyHandle {
  version: string
  manifest: () => ManifestEntry[]
  current: () => VerifyResult | null
  runAll: () => Promise<VerifyResult[]>
}
