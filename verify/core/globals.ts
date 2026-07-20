import type { DocSeed, VerifyHandle } from './types'

/**
 * 検証用コメント。
 * 検証用コメント。
 * 検証用コメント。
 * - window.__verify handle (browser)
 */
interface VerifyGlobals {
  __verifyFirestoreSeed?: (data: Record<string, DocSeed[]>) => void
  __verifyFirestoreReset?: () => void
  __verifyNav?: { pathname: string; calls: Array<{ method: string; args: unknown[] }> }
  __verify?: VerifyHandle
}

export function verifyGlobals(): VerifyGlobals {
  return globalThis as unknown as VerifyGlobals
}
