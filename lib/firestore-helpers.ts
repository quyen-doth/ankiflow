export function withTimestamps<T extends Record<string, unknown>>(
  data: T,
  isNew: boolean
): T & { created_at?: Date; updated_at: Date } {
  const now = new Date()
  return isNew
    ? { ...data, created_at: now, updated_at: now }
    : { ...data, updated_at: now }
}
