import { verifyGlobals } from '@/verify/core/globals'
import { allUnits, buildManifest } from '@/verify/core/registry'
import { runUnit } from '@/verify/core/runner'
import type { VerifyHandle, VerifyResult } from '@/verify/core/types'

let currentResult: VerifyResult | null = null

/** UnitPage が現在 mount の結果を publish し、agent が読めるようにする */
export function setCurrentResult(result: VerifyResult | null): void {
  currentResult = result
}

/** window.__verify を設定する — agent が console から操作する構造化 API */
export function installVerifyHandle(): VerifyHandle {
  const handle: VerifyHandle = {
    version: '1.0',
    manifest: () => buildManifest(),
    current: () => currentResult,
    runAll: async () => {
      const results: VerifyResult[] = []
      for (const unit of allUnits()) {
        results.push(...(await runUnit(unit)))
      }
      return results
    },
  }
  verifyGlobals().__verify = handle
  return handle
}
