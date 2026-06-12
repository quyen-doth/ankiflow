import { verifyGlobals } from '@/verify/core/globals'
import { allUnits, buildManifest } from '@/verify/core/registry'
import { runUnit } from '@/verify/core/runner'
import type { VerifyHandle, VerifyResult } from '@/verify/core/types'

let currentResult: VerifyResult | null = null

/** UnitPage gọi để publish kết quả của mount hiện tại cho agent đọc */
export function setCurrentResult(result: VerifyResult | null): void {
  currentResult = result
}

/** Cài window.__verify — API có cấu trúc cho agent điều khiển từ console */
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
