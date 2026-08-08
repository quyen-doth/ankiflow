import type { DocSeed, VerifyHandle } from './types'

/** runnerと環境を疎結合に保つため、環境別hookをtyped global経由で受け渡す。 */
interface VerifyGlobals {
  __verifyFirestoreSeed?: (data: Record<string, DocSeed[]>) => void
  __verifyFirestoreReset?: () => void
  __verifyNav?: { pathname: string; calls: Array<{ method: string; args: unknown[] }> }
  __verify?: VerifyHandle
}

export function verifyGlobals(): VerifyGlobals {
  return globalThis as unknown as VerifyGlobals
}
