/**
 * Stub cho '@/lib/firebase' — CHỈ active trong vitest qua resolve.alias.
 * Export `db`/`auth` giả để components import không khởi tạo Firebase client thật.
 */
export const db = {} as Record<string, never>
export const auth = {} as Record<string, never>
