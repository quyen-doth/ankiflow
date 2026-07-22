import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { AuthContext } from '@/components/providers/AuthProvider'
import { readContract } from './contract'
import { verifyGlobals } from './globals'
import { verifiersFor } from './registry'
import { TEST_AUTH_USER } from './test-auth-user'
import type {
  ActContext,
  Check,
  Fixture,
  Verdict,
  VerifiableUnit,
  VerifyResult,
} from './types'
import { installMockFetch } from '@/verify/harness/mock-fetch'

export interface RunOptions {
  /** off-screen container ではなく既存 container (UnitPage) へ mount する */
  container?: HTMLElement
  /** verify 後も component を mounted のまま保持する (UnitPage で視覚確認する) */
  keepMounted?: boolean
}

/** macrotask を1回待って React の render flush を完了させる */
function flush(ms = 0): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 検証用コメント。
// 検証用コメント。
export { TEST_AUTH_USER }

// 検証用コメント。
// 検証用コメント。
const visibleRoots = new WeakMap<HTMLElement, Root>()

function computeVerdict(checks: Check[], blockedReason?: string): Verdict {
  if (blockedReason) return 'BLOCKED'
  if (checks.some(c => c.status === 'fail')) return 'FAIL'
  if (checks.some(c => c.status === 'skip')) return 'SKIP'
  return 'PASS'
}

function buildActContext(root: HTMLElement): ActContext {
  return {
    root,
    click: async selector => {
      const el = root.querySelector<HTMLElement>(selector)
      if (!el) throw new Error(`act.click: "${selector}" が見つかりません`)
      flushSync(() => {
        el.click()
      })
      await flush()
    },
    type: async (selector, text) => {
      const el = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)
      if (!el) throw new Error(`act.type: "${selector}" が見つかりません`)
      // 検証用コメント。
      const proto = el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
      setter?.call(el, text)
      flushSync(() => {
        el.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await flush()
    },
    wait: ms => flush(ms),
  }
}

/**
 * 検証用コメント。
 * install mocks → mount → act → run verifiers → verdict → cleanup.
 */
export async function runFixture<P>(
  unit: VerifiableUnit<P>,
  fixture: Fixture<P>,
  opts: RunOptions = {}
): Promise<VerifyResult> {
  const startedAt = performance.now()
  const checks: Check[] = []
  const restoreFns: Array<() => void> = []
  let blockedReason: string | undefined
  let domSnapshot: Record<string, string> = {}

  const globals = verifyGlobals()

  // 検証用コメント。
  // 検証用コメント。
  if (fixture.mocks?.firestore && !globals.__verifyFirestoreSeed) {
    return {
      unitId: unit.id,
      fixtureId: fixture.id,
      verdict: 'SKIP',
      checks: [],
      domSnapshot: {},
      durationMs: Math.round(performance.now() - startedAt),
      skipReason: 'firestore mock unavailable in browser — run via vitest',
      timestamp: new Date().toISOString(),
    }
  }

  let container = opts.container
  let createdContainer = false
  if (!container) {
    container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-10000px'
    container.style.width = '800px'
    document.body.appendChild(container)
    createdContainer = true
  }

  let reactRoot: Root | null = null

  try {
    // --- Install mocks ---
    if (fixture.mocks?.fetch) {
      restoreFns.push(installMockFetch(fixture.mocks.fetch))
    }
    if (fixture.mocks?.firestore && globals.__verifyFirestoreSeed) {
      globals.__verifyFirestoreSeed(fixture.mocks.firestore)
      restoreFns.push(() => globals.__verifyFirestoreReset?.())
    }
    if (fixture.mocks?.localStorage) {
      for (const [key, value] of Object.entries(fixture.mocks.localStorage)) {
        localStorage.setItem(key, value)
      }
      const seededKeys = Object.keys(fixture.mocks.localStorage)
      restoreFns.push(() => seededKeys.forEach(key => localStorage.removeItem(key)))
    }
    if (fixture.mocks?.pathname && globals.__verifyNav) {
      const nav = globals.__verifyNav
      const previous = nav.pathname
      nav.pathname = fixture.mocks.pathname
      nav.calls.length = 0
      restoreFns.push(() => {
        nav.pathname = previous
      })
    }

    // --- Mount ---
    if (opts.keepMounted) {
      reactRoot = visibleRoots.get(container) ?? createRoot(container)
      visibleRoots.set(container, reactRoot)
    } else {
      reactRoot = createRoot(container)
    }
    const root = reactRoot
    const authValue = fixture.mocks?.auth
      ? {
          user: fixture.mocks.auth.user,
          loading: fixture.mocks.auth.loading ?? false,
        }
      : { user: { ...TEST_AUTH_USER }, loading: false }
    flushSync(() => {
      root.render(
        createElement(
          AuthContext.Provider,
          { value: authValue },
          unit.render(fixture.props),
        ),
      )
    })
    await flush()

    // --- Act ---
    if (fixture.act) {
      await fixture.act(buildActContext(container))
      await flush()
    }

    // --- Verify ---
    const contract = readContract(container)
    domSnapshot = contract
    for (const verifier of verifiersFor(unit as VerifiableUnit)) {
      try {
        const result = await verifier.run({
          unit: unit as VerifiableUnit,
          fixture: fixture as Fixture,
          root: container,
          contract,
        })
        checks.push(...result)
      } catch (e) {
        checks.push({
          verifier: verifier.id,
          status: 'fail',
          label: `Verifier "${verifier.id}" が exception を投げました`,
          detail: e instanceof Error ? e.message : String(e),
        })
      }
    }
  } catch (e) {
    blockedReason = e instanceof Error ? e.message : String(e)
  } finally {
    if (!opts.keepMounted) {
      try {
        flushSync(() => {
          reactRoot?.unmount()
        })
      } catch {
        // 検証用コメント。
      }
      if (createdContainer) container.remove()
    }
    // 検証用コメント。
    for (const restore of restoreFns.reverse()) restore()
  }

  return {
    unitId: unit.id,
    fixtureId: fixture.id,
    verdict: computeVerdict(checks, blockedReason),
    checks,
    domSnapshot,
    durationMs: Math.round(performance.now() - startedAt),
    blockedReason,
    timestamp: new Date().toISOString(),
  }
}

/** unit の全 fixture を実行する */
export async function runUnit(unit: VerifiableUnit): Promise<VerifyResult[]> {
  const results: VerifyResult[] = []
  for (const fixture of unit.fixtures) {
    results.push(await runFixture(unit, fixture))
  }
  return results
}
