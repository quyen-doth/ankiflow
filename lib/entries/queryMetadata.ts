import { normalizedEntryPrimaryValue } from '@/lib/entries/duplicate'

export const ENTRY_QUERY_FIELD_PREFIX = '_query_' as const
export const ENTRY_QUERY_SCHEMA_VERSION = 1 as const
export const ENTRY_QUERY_SCHEMA_VERSION_FIELD = '_query_schema_version' as const
export const ENTRY_QUERY_DUPLICATE_KEY_FIELD = '_query_duplicate_key' as const
export const ENTRY_QUERY_CARD_COUNT_FIELD = '_query_card_count' as const
export const ENTRY_QUERY_GLOBAL_VERSION_FIELD = 'entry_query_schema_version' as const
export const ENTRY_QUERY_GLOBAL_READY_AT_FIELD = 'entry_query_schema_ready_at' as const

export const ENTRY_QUERY_MANAGED_FIELDS = [
  ENTRY_QUERY_SCHEMA_VERSION_FIELD,
  ENTRY_QUERY_DUPLICATE_KEY_FIELD,
  ENTRY_QUERY_CARD_COUNT_FIELD,
] as const

export interface EntryQueryMetadata {
  [ENTRY_QUERY_SCHEMA_VERSION_FIELD]: typeof ENTRY_QUERY_SCHEMA_VERSION
  [ENTRY_QUERY_DUPLICATE_KEY_FIELD]: string
  [ENTRY_QUERY_CARD_COUNT_FIELD]: number
}

/** Query metadata は server-side writer が必ず同じ規則で再計算する。 */
export function deriveEntryQueryMetadata(
  data: Record<string, unknown>,
): EntryQueryMetadata {
  const cardTypeIds = Array.isArray(data.card_type_ids)
    ? data.card_type_ids.filter(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    )
    : []

  return {
    [ENTRY_QUERY_SCHEMA_VERSION_FIELD]: ENTRY_QUERY_SCHEMA_VERSION,
    [ENTRY_QUERY_DUPLICATE_KEY_FIELD]: normalizedEntryPrimaryValue(data),
    [ENTRY_QUERY_CARD_COUNT_FIELD]: cardTypeIds.length,
  }
}

/** Content Type / AI / request payload で予約する system namespace。 */
export function isReservedEntryQueryField(key: string): boolean {
  return key.trim().toLocaleLowerCase('en-US').startsWith(ENTRY_QUERY_FIELD_PREFIX)
}

export function findReservedEntryQueryFields(input: unknown): string[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return []
  return Object.keys(input)
    .filter(isReservedEntryQueryField)
    .sort((left, right) => left.localeCompare(right))
}

export function reservedEntryQueryFieldsError(fields: readonly string[]): string {
  return `Entry query metadata is server-managed: ${fields.join(', ')}`
}

export function entryQueryMetadataMatches(data: Record<string, unknown>): boolean {
  const expected = deriveEntryQueryMetadata(data)
  return ENTRY_QUERY_MANAGED_FIELDS.every(field => data[field] === expected[field])
}
