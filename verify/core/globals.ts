import type { DocSeed, VerifyHandle } from './types'

/**
 * Truy cập typed các global hooks giữa runner và môi trường:
 * - firestore stub (chỉ tồn tại trong vitest qua module alias)
 * - navigation mock (chỉ tồn tại trong vitest qua vi.mock trong test-setup)
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
