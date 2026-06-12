/**
 * Stub cho '@/lib/firebase' — CHỈ active trong vitest qua resolve.alias.
 * Export `db` giả để components import không khởi tạo Firebase client thật.
 */
export const db = {} as Record<string, never>
