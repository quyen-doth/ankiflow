import { normalizeTerm } from '../lib/entries/duplicate'

export const COPY_MASTER_COLLECTIONS = [
  'user_content_types',
  'categories',
  'card_types',
  'topics',
  'decks',
] as const

export const COPY_FULL_ONLY_COLLECTIONS = ['entries', 'review_events'] as const

export type CopyMode = 'full' | 'master'
export type CopyMasterCollection = (typeof COPY_MASTER_COLLECTIONS)[number]
export type CopyCollection = CopyMasterCollection | (typeof COPY_FULL_ONLY_COLLECTIONS)[number]

export interface CopyDocument {
  id: string
  data: Record<string, unknown>
}

export type CopySnapshot = Record<CopyCollection, CopyDocument[]>

export interface CopyDocumentIndexes {
  byCopiedFrom: Map<string, string>
  byNaturalKey: Map<string, string>
}

export interface CopyReferenceMaps {
  categoryIds: ReadonlyMap<string, string>
  cardTypeIds: ReadonlyMap<string, string>
  topicIds: ReadonlyMap<string, string>
}

export interface CopySummaryRow {
  created: number
  reused: number
  skipped: number
}

export interface CopyOperation {
  collection: CopyCollection
  id: string
  data: Record<string, unknown>
}

export interface CopyPlan {
  operations: CopyOperation[]
  summary: Record<CopyCollection, CopySummaryRow>
  warnings: string[]
  duplicateEntries: string[]
}

export interface BuildCopyPlanInput {
  mode: CopyMode
  targetUid: string
  source: CopySnapshot
  target: CopySnapshot
  now: Date
  createId: (collection: CopyCollection) => string
}

export interface CopyUserDataArgs {
  fromUid: string
  toUid: string
  mode: CopyMode
  apply: boolean
  help: boolean
}

export interface RemapResult {
  data: Record<string, unknown>
  warnings: string[]
}

const EMPTY_SUMMARY_ROW = (): CopySummaryRow => ({ created: 0, reused: 0, skipped: 0 })

function normalizedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizedLowercase(value: unknown): string | null {
  return normalizedString(value)?.toLocaleLowerCase('en-US') ?? null
}

function keyParts(...values: Array<string | null>): string | null {
  return values.every((value): value is string => value !== null) ? JSON.stringify(values) : null
}

/** Collection ごとの論理キー。card_types は言語別の同一 code を区別する。 */
export function naturalKeyFor(
  collection: CopyCollection,
  data: Record<string, unknown>,
): string | null {
  switch (collection) {
    case 'categories':
    case 'topics':
      return keyParts(normalizedLowercase(data.name), normalizedLowercase(data.form_type))
    case 'card_types': {
      const language = data.language === null || data.language === undefined
        ? '__none__'
        : normalizedLowercase(data.language)
      return keyParts(
        normalizedLowercase(data.code),
        normalizedLowercase(data.form_type),
        language,
      )
    }
    case 'decks':
      return normalizedLowercase(data.anki_deck_name)
    case 'user_content_types':
      return normalizedLowercase(data.code)
    case 'entries':
      return entryNaturalKey(data)
    case 'review_events':
      return null
  }
}

export function entryNaturalKey(data: Record<string, unknown>): string | null {
  const term = [data.word, data.term, data.title].find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )
  return term ? normalizeTerm(term) : null
}

/** Target snapshot を copied_from と論理キーで検索できる形へ一度だけ変換する。 */
export function buildDocumentIndexes(
  collection: CopyCollection,
  documents: CopyDocument[],
): CopyDocumentIndexes {
  const byCopiedFrom = new Map<string, string>()
  const byNaturalKey = new Map<string, string>()

  for (const document of [...documents].sort((left, right) => left.id.localeCompare(right.id))) {
    const copiedFrom = normalizedString(document.data.copied_from)
    if (copiedFrom && !byCopiedFrom.has(copiedFrom)) byCopiedFrom.set(copiedFrom, document.id)

    const naturalKey = naturalKeyFor(collection, document.data)
    if (naturalKey && !byNaturalKey.has(naturalKey)) byNaturalKey.set(naturalKey, document.id)
  }

  return { byCopiedFrom, byNaturalKey }
}

export function resolveMasterTarget(
  collection: CopyMasterCollection,
  sourceDocument: CopyDocument,
  indexes: CopyDocumentIndexes,
  createTargetId: string,
): { action: 'reuse' | 'create'; targetId: string } {
  const copiedTargetId = indexes.byCopiedFrom.get(sourceDocument.id)
  if (copiedTargetId) return { action: 'reuse', targetId: copiedTargetId }

  const naturalKey = naturalKeyFor(collection, sourceDocument.data)
  const naturalTargetId = naturalKey ? indexes.byNaturalKey.get(naturalKey) : undefined
  if (naturalTargetId) return { action: 'reuse', targetId: naturalTargetId }

  return { action: 'create', targetId: createTargetId }
}

function remapReferenceArray(
  value: unknown,
  references: ReadonlyMap<string, string>,
  fieldName: string,
): { ids: string[]; warnings: string[] } {
  const sourceIds = Array.isArray(value)
    ? value.filter((id): id is string => typeof id === 'string')
    : []
  const warnings: string[] = []
  const ids = sourceIds.flatMap(id => {
    const targetId = references.get(id)
    if (targetId) return [targetId]
    warnings.push(`${fieldName}: unresolved reference "${id}" was dropped.`)
    return []
  })
  return { ids, warnings }
}

export function remapDeckForCopy(
  data: Record<string, unknown>,
  maps: Pick<CopyReferenceMaps, 'categoryIds' | 'cardTypeIds'>,
): RemapResult {
  const cardTypes = remapReferenceArray(
    data.default_card_type_ids,
    maps.cardTypeIds,
    'default_card_type_ids',
  )
  const warnings = [...cardTypes.warnings]

  let defaultCategoryId: string | null = null
  if (typeof data.default_category_id === 'string') {
    defaultCategoryId = maps.categoryIds.get(data.default_category_id) ?? null
    if (!defaultCategoryId) {
      warnings.push(
        `default_category_id: unresolved reference "${data.default_category_id}" was replaced with null.`,
      )
    }
  }

  return {
    data: {
      ...data,
      default_card_type_ids: cardTypes.ids,
      default_category_id: defaultCategoryId,
    },
    warnings,
  }
}

export function remapEntryForCopy(
  data: Record<string, unknown>,
  maps: CopyReferenceMaps,
  targetUid: string,
): RemapResult {
  const cardTypes = remapReferenceArray(data.card_type_ids, maps.cardTypeIds, 'card_type_ids')
  const topics = remapReferenceArray(data.topic_ids, maps.topicIds, 'topic_ids')
  const warnings = [...cardTypes.warnings, ...topics.warnings]

  let categoryId: string | null = null
  if (typeof data.category_id === 'string') {
    categoryId = maps.categoryIds.get(data.category_id) ?? null
    if (!categoryId) {
      warnings.push(`category_id: unresolved reference "${data.category_id}" was replaced with null.`)
    }
  }

  return {
    data: {
      ...data,
      user_id: targetUid,
      category_id: categoryId,
      card_type_ids: cardTypes.ids,
      topic_ids: topics.ids,
      anki_note_ids: [],
      status: data.status === 'synced' ? 'reviewed' : data.status,
    },
    warnings,
  }
}

export function remapReviewEventForCopy(
  data: Record<string, unknown>,
  entryIdMap: ReadonlyMap<string, string>,
  targetUid: string,
): Record<string, unknown> | null {
  const sourceEntryId = normalizedString(data.entry_id)
  if (!sourceEntryId) return null
  const targetEntryId = entryIdMap.get(sourceEntryId)
  if (!targetEntryId) return null
  return { ...data, user_id: targetUid, entry_id: targetEntryId }
}

function copyMetadata(
  data: Record<string, unknown>,
  sourceId: string,
  targetUid: string,
  now: Date,
): Record<string, unknown> {
  return {
    ...data,
    user_id: targetUid,
    copied_from: sourceId,
    copied_at: now,
    updated_at: now,
  }
}

function emptySummary(): Record<CopyCollection, CopySummaryRow> {
  return {
    user_content_types: EMPTY_SUMMARY_ROW(),
    categories: EMPTY_SUMMARY_ROW(),
    card_types: EMPTY_SUMMARY_ROW(),
    topics: EMPTY_SUMMARY_ROW(),
    decks: EMPTY_SUMMARY_ROW(),
    entries: EMPTY_SUMMARY_ROW(),
    review_events: EMPTY_SUMMARY_ROW(),
  }
}

function prefixWarnings(collection: CopyCollection, sourceId: string, warnings: string[]): string[] {
  return warnings.map(warning => `${collection}/${sourceId}: ${warning}`)
}

/** Source/target snapshot から、dry-run と apply が共有する決定論的な copy plan を作る。 */
export function buildCopyPlan(input: BuildCopyPlanInput): CopyPlan {
  const summary = emptySummary()
  const operations: CopyOperation[] = []
  const warnings: string[] = []
  const duplicateEntries: string[] = []
  const idMaps = {
    categories: new Map<string, string>(),
    card_types: new Map<string, string>(),
    topics: new Map<string, string>(),
  }

  for (const collection of COPY_MASTER_COLLECTIONS) {
    const indexes = buildDocumentIndexes(collection, input.target[collection])
    const sourceDocuments = [...input.source[collection]].sort((left, right) =>
      left.id.localeCompare(right.id),
    )

    for (const sourceDocument of sourceDocuments) {
      const createTargetId = input.createId(collection)
      const resolution = resolveMasterTarget(collection, sourceDocument, indexes, createTargetId)
      if (resolution.action === 'reuse') {
        summary[collection].reused += 1
      } else {
        let remapped = { data: sourceDocument.data, warnings: [] as string[] }
        if (collection === 'decks') {
          remapped = remapDeckForCopy(sourceDocument.data, {
            categoryIds: idMaps.categories,
            cardTypeIds: idMaps.card_types,
          })
        }
        operations.push({
          collection,
          id: resolution.targetId,
          data: copyMetadata(remapped.data, sourceDocument.id, input.targetUid, input.now),
        })
        summary[collection].created += 1
        warnings.push(...prefixWarnings(collection, sourceDocument.id, remapped.warnings))

        indexes.byCopiedFrom.set(sourceDocument.id, resolution.targetId)
        const naturalKey = naturalKeyFor(collection, sourceDocument.data)
        if (naturalKey && !indexes.byNaturalKey.has(naturalKey)) {
          indexes.byNaturalKey.set(naturalKey, resolution.targetId)
        }
      }

      if (collection === 'categories' || collection === 'card_types' || collection === 'topics') {
        idMaps[collection].set(sourceDocument.id, resolution.targetId)
      }
    }
  }

  if (input.mode === 'master') return { operations, summary, warnings, duplicateEntries }

  const entryIndexes = buildDocumentIndexes('entries', input.target.entries)
  const entryIdMap = new Map<string, string>()
  for (const sourceDocument of [...input.source.entries].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    const copiedTargetId = entryIndexes.byCopiedFrom.get(sourceDocument.id)
    if (copiedTargetId) {
      entryIdMap.set(sourceDocument.id, copiedTargetId)
      summary.entries.reused += 1
      continue
    }

    const naturalKey = entryNaturalKey(sourceDocument.data)
    const duplicateTargetId = naturalKey ? entryIndexes.byNaturalKey.get(naturalKey) : undefined
    if (duplicateTargetId) {
      summary.entries.skipped += 1
      duplicateEntries.push(
        `${sourceDocument.id} (${naturalKey ?? 'unknown'}) -> existing entries/${duplicateTargetId}`,
      )
      continue
    }

    const targetId = input.createId('entries')
    const remapped = remapEntryForCopy(sourceDocument.data, {
      categoryIds: idMaps.categories,
      cardTypeIds: idMaps.card_types,
      topicIds: idMaps.topics,
    }, input.targetUid)
    operations.push({
      collection: 'entries',
      id: targetId,
      data: copyMetadata(remapped.data, sourceDocument.id, input.targetUid, input.now),
    })
    entryIdMap.set(sourceDocument.id, targetId)
    entryIndexes.byCopiedFrom.set(sourceDocument.id, targetId)
    if (naturalKey && !entryIndexes.byNaturalKey.has(naturalKey)) {
      entryIndexes.byNaturalKey.set(naturalKey, targetId)
    }
    summary.entries.created += 1
    warnings.push(...prefixWarnings('entries', sourceDocument.id, remapped.warnings))
  }

  const reviewEventIndexes = buildDocumentIndexes('review_events', input.target.review_events)
  for (const sourceDocument of [...input.source.review_events].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    if (reviewEventIndexes.byCopiedFrom.has(sourceDocument.id)) {
      summary.review_events.reused += 1
      continue
    }

    const remapped = remapReviewEventForCopy(sourceDocument.data, entryIdMap, input.targetUid)
    if (!remapped) {
      summary.review_events.skipped += 1
      continue
    }

    const targetId = input.createId('review_events')
    operations.push({
      collection: 'review_events',
      id: targetId,
      data: { ...remapped, copied_from: sourceDocument.id },
    })
    reviewEventIndexes.byCopiedFrom.set(sourceDocument.id, targetId)
    summary.review_events.created += 1
  }

  return { operations, summary, warnings, duplicateEntries }
}

function optionValue(args: string[], option: string): string | null {
  const positions = args.flatMap((argument, index) => argument === option ? [index] : [])
  if (positions.length > 1) throw new Error(`Duplicate argument: ${option}`)
  if (positions.length === 0) return null
  const value = args[positions[0] + 1]
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${option}`)
  return value
}

export function parseCopyUserDataArgs(args: string[]): CopyUserDataArgs {
  const help = args.includes('--help') || args.includes('-h')
  const allowedFlags = new Set(['--from', '--to', '--mode', '--apply', '--help', '-h'])
  const valuePositions = new Set<number>()
  for (const option of ['--from', '--to', '--mode']) {
    args.forEach((argument, index) => {
      if (argument === option) valuePositions.add(index + 1)
    })
  }
  const unknown = args.filter((argument, index) => !valuePositions.has(index) && !allowedFlags.has(argument))
  if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`)

  if (help) return { fromUid: '', toUid: '', mode: 'full', apply: false, help: true }

  const fromUid = optionValue(args, '--from')
  const toUid = optionValue(args, '--to')
  const mode = optionValue(args, '--mode')
  if (!fromUid || !toUid || !mode) {
    throw new Error('--from, --to, and --mode are required')
  }
  if (fromUid === toUid) throw new Error('--from and --to must be different Firebase UIDs')
  if (mode !== 'full' && mode !== 'master') throw new Error('--mode must be "full" or "master"')

  return {
    fromUid,
    toUid,
    mode,
    apply: args.includes('--apply'),
    help: false,
  }
}

export function emptyCopySnapshot(): CopySnapshot {
  return {
    user_content_types: [],
    categories: [],
    card_types: [],
    topics: [],
    decks: [],
    entries: [],
    review_events: [],
  }
}
