import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = process.cwd()
const API_ROOT = join(REPO_ROOT, 'app/api')

type EvidenceKind =
  | 'owner-query'
  | 'owner-create'
  | 'point-ownership-check'
  | 'uid-keyed-doc'
  | 'ownership-tested-helper'
  | 'global-data'

interface ScopeEvidence {
  evidence: readonly [EvidenceKind, ...EvidenceKind[]]
  note: string
}

const EVIDENCE_KINDS = new Set<EvidenceKind>([
  'owner-query',
  'owner-create',
  'point-ownership-check',
  'uid-keyed-doc',
  'ownership-tested-helper',
  'global-data',
])

const ADMIN_SDK_AUTH_EXPORTS: Record<string, ScopeEvidence> = {
  'admin/content-types::GET': {
    evidence: ['global-data'],
    note: 'app/api/admin/content-types/route.ts:13-18 reads global content type defaults; mutations use withAdmin.',
  },
  'anki/resync::POST': {
    evidence: ['owner-query'],
    note: "app/api/anki/resync/route.ts:32-36 filters entries by user_id == uid.",
  },
  'anki/sync-srs::GET': {
    evidence: ['owner-query'],
    note: "app/api/anki/sync-srs/route.ts:20-24 filters entries by user_id == uid.",
  },
  'anki/sync-srs::POST': {
    evidence: ['owner-query', 'owner-create'],
    note: 'app/api/anki/sync-srs/route.ts:103-108 scopes entries; lines 189-197 attach user_id to review events.',
  },
  'anki/update::PUT': {
    evidence: ['point-ownership-check'],
    note: 'app/api/anki/update/route.ts:46-59 uses the tested owned-entry updater or compares user_id to uid.',
  },
  'audio/generate::POST': {
    evidence: ['global-data'],
    note: 'app/api/audio/generate/route.ts:8-16 reads only settings/global as an application-wide cost gate.',
  },
  'dashboard::GET': {
    evidence: ['ownership-tested-helper'],
    note: 'loadDashboard(db, uid, ...) is covered by verify/unit/dashboard-query.test.ts.',
  },
  'entries/check-duplicate::POST': {
    evidence: ['ownership-tested-helper'],
    note: 'lookupEntryDuplicates(db, uid, ...) is covered by verify/unit/duplicate-lookup.test.ts.',
  },
  'entries/save::POST': {
    evidence: ['owner-create'],
    note: 'app/api/entries/save/route.ts:37-50 forces user_id: uid before creating the entry.',
  },
  'entries/sync::GET': {
    evidence: ['owner-query'],
    note: "app/api/entries/sync/route.ts:18-22 filters entries by user_id == uid.",
  },
  'entries/sync::POST': {
    evidence: ['point-ownership-check'],
    note: 'app/api/entries/sync/route.ts:76-80 reads each point lookup and compares user_id to uid before update.',
  },
  'generate::POST': {
    evidence: ['point-ownership-check'],
    note: 'app/api/generate/route.ts:123-129 treats a user_content_types ownership mismatch as not found.',
  },
  'history::GET': {
    evidence: ['ownership-tested-helper'],
    note: 'loadHistoryPage(db, uid, ...) is covered by verify/unit/history-query.test.ts.',
  },
  'history::POST': {
    evidence: ['owner-create'],
    note: 'app/api/history/route.ts:44-50 forces user_id: uid before creating the entry.',
  },
  'history/[id]::GET': {
    evidence: ['point-ownership-check'],
    note: 'app/api/history/[id]/route.ts:17-24 compares user_id to uid in getOwnedEntryRef.',
  },
  'history/[id]::PUT': {
    evidence: ['point-ownership-check'],
    note: 'app/api/history/[id]/route.ts:52-56 uses updateOwnedEntryWithQueryMetadata, covered by entry-transaction-update.test.ts.',
  },
  'history/[id]::DELETE': {
    evidence: ['point-ownership-check'],
    note: 'app/api/history/[id]/route.ts:64-71 deletes only the reference returned by getOwnedEntryRef.',
  },
  'history/bulk-delete::POST': {
    evidence: ['point-ownership-check', 'uid-keyed-doc'],
    note: 'app/api/history/bulk-delete/route.ts:21-27 filters point reads by owner; lines 45-49 writes settings/{uid}.',
  },
  'history/facets::GET': {
    evidence: ['ownership-tested-helper'],
    note: 'loadHistoryFacets(db, uid) is covered by verify/unit/history-query.test.ts.',
  },
  'image::GET': {
    evidence: ['global-data'],
    note: 'app/api/image/route.ts:7-15 reads only settings/global as an application-wide cost gate.',
  },
  'notifications/line-link::POST': {
    evidence: ['owner-query', 'owner-create'],
    note: "app/api/notifications/line-link/route.ts:28-39 queries uid == uid and creates a code containing uid.",
  },
  'notifications/line-link::DELETE': {
    evidence: ['uid-keyed-doc'],
    note: 'app/api/notifications/line-link/route.ts:58-64 updates only settings/{uid}.',
  },
}

const OWNERSHIP_TESTED_HELPERS = {
  loadDashboard: {
    source: 'lib/dashboard/dashboardQuery.ts',
    test: 'verify/unit/dashboard-query.test.ts',
  },
  loadHistoryFacets: {
    source: 'lib/history/historyQuery.ts',
    test: 'verify/unit/history-query.test.ts',
  },
  lookupEntryDuplicates: {
    source: 'lib/entries/duplicateLookup.ts',
    test: 'verify/unit/duplicate-lookup.test.ts',
  },
  loadHistoryPage: {
    source: 'lib/history/historyQuery.ts',
    test: 'verify/unit/history-query.test.ts',
  },
} as const

const MASTER_COLLECTIONS = ['decks', 'categories', 'card_types', 'topics'] as const
type MasterCollection = typeof MASTER_COLLECTIONS[number]

interface MasterCollectionAccess {
  collection: MasterCollection
  file: string
  key: string
  sourceAfterAccess: string
}

const SAFE_MASTER_COLLECTION_ACCESS = {
  'app/api/integrations/term-drafts/route.ts::POST': {
    collection: 'decks',
    evidence: 'owner-query',
    note: 'The static integration route scopes its default deck query to INTEGRATION_TARGET_UID.',
  },
  'lib/firestore-helpers.ts::fetchCardTypesByIds': {
    collection: 'card_types',
    evidence: 'point-ownership-filter',
    note: 'The shared point-lookup helper drops documents whose user_id does not match the authenticated uid.',
  },
} as const

const DEFERRED_DEBT_ALLOWLIST = {} as const

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.isFile() && /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : []
  })
}

function repoPath(path: string): string {
  return relative(REPO_ROOT, path).split(sep).join('/')
}

function actualAdminSdkAuthExports(): string[] {
  const exportPattern = /export\s+const\s+(GET|POST|PUT|DELETE|PATCH)\s*=\s*withAuth\s*\(/g

  return sourceFiles(API_ROOT).flatMap(path => {
    if (!path.endsWith(`${sep}route.ts`)) return []
    const source = readFileSync(path, 'utf8')
    if (!source.includes('getAdminDb') || !source.includes('withAuth')) return []
    const route = repoPath(path).replace(/^app\/api\//, '').replace(/\/route\.ts$/, '')
    return [...source.matchAll(exportPattern)].map(match => `${route}::${match[1]}`)
  }).sort()
}

function containingFunctionName(source: string, accessIndex: number): string | null {
  const functionPattern = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g
  let name: string | null = null
  for (const match of source.slice(0, accessIndex).matchAll(functionPattern)) {
    name = match[1]
  }
  return name
}

function findMasterCollectionAccesses(source: string, file: string): MasterCollectionAccess[] {
  const collectionPattern = /\.collection\(\s*(['"])(decks|categories|card_types|topics)\1\s*\)/g

  return [...source.matchAll(collectionPattern)].map(match => {
    const collection = match[2] as MasterCollection
    const accessIndex = match.index ?? 0
    const functionName = containingFunctionName(source, accessIndex)
    return {
      collection,
      file,
      key: `${file}::${functionName ?? collection}`,
      sourceAfterAccess: source.slice(accessIndex, accessIndex + 300),
    }
  })
}

function actualMasterCollectionAccesses(): MasterCollectionAccess[] {
  return [join(REPO_ROOT, 'app/api'), join(REPO_ROOT, 'lib')]
    .flatMap(sourceFiles)
    .flatMap(path => findMasterCollectionAccesses(readFileSync(path, 'utf8'), repoPath(path)))
    .sort((left, right) => left.key.localeCompare(right.key))
}

describe('Admin SDK UID scope regression guards', () => {
  it('Guard A: every getAdminDb + withAuth export requires reviewed per-export evidence', () => {
    const actual = actualAdminSdkAuthExports()
    const registered = Object.keys(ADMIN_SDK_AUTH_EXPORTS).sort()

    expect(actual).toEqual(registered)
    expect(registered).toHaveLength(22)

    for (const entry of Object.values(ADMIN_SDK_AUTH_EXPORTS)) {
      expect(entry.note.trim().length).toBeGreaterThan(0)
      expect(entry.evidence.length).toBeGreaterThan(0)
      expect(new Set(entry.evidence).size).toBe(entry.evidence.length)
      for (const evidence of entry.evidence) {
        expect(EVIDENCE_KINDS.has(evidence)).toBe(true)
      }
    }
  })

  it('Guard A: every ownership-tested helper has source and UID-filter test evidence', () => {
    const helperEntries = Object.entries(OWNERSHIP_TESTED_HELPERS)

    for (const [helper, evidence] of helperEntries) {
      const source = readFileSync(join(REPO_ROOT, evidence.source), 'utf8')
      const testSource = readFileSync(join(REPO_ROOT, evidence.test), 'utf8')
      expect(source).toContain(`function ${helper}`)
      expect(testSource).toContain(helper)
      expect(testSource).toContain("['user_id', '==', 'uid-1']")
    }

    const helperBackedEntries = Object.values(ADMIN_SDK_AUTH_EXPORTS)
      .filter(entry => entry.evidence.includes('ownership-tested-helper'))
    for (const entry of helperBackedEntries) {
      expect(helperEntries.some(([helper]) => entry.note.includes(helper))).toBe(true)
    }
  })

  it('Guard B: only reviewed safe accesses touch master collections', () => {
    const accesses = actualMasterCollectionAccesses()
    const expectedKeys = [
      ...Object.keys(SAFE_MASTER_COLLECTION_ACCESS),
      ...Object.keys(DEFERRED_DEBT_ALLOWLIST),
    ].sort()

    expect(accesses.map(access => access.key)).toEqual(expectedKeys)
    expect(new Set(accesses.map(access => access.key)).size).toBe(accesses.length)
    for (const access of accesses) expect(MASTER_COLLECTIONS).toContain(access.collection)

    for (const [key, review] of Object.entries(SAFE_MASTER_COLLECTION_ACCESS)) {
      expect(accesses.find(access => access.key === key)?.collection).toBe(review.collection)
    }

    const safeAccess = accesses.find(access => access.key === 'app/api/integrations/term-drafts/route.ts::POST')
    expect(safeAccess?.sourceAfterAccess).toMatch(
      /\.collection\('decks'\)[\s\S]*?\.where\('user_id',\s*'==',\s*targetUid\)/,
    )
    expect(SAFE_MASTER_COLLECTION_ACCESS['app/api/integrations/term-drafts/route.ts::POST'].evidence)
      .toBe('owner-query')
    expect(SAFE_MASTER_COLLECTION_ACCESS['app/api/integrations/term-drafts/route.ts::POST'].note.trim())
      .not.toBe('')

    const pointAccess = accesses.find(access => access.key === 'lib/firestore-helpers.ts::fetchCardTypesByIds')
    expect(pointAccess?.sourceAfterAccess).toMatch(
      /\.collection\('card_types'\)[\s\S]*?\.filter\([\s\S]*?\.data\(\)\?\.user_id\s*===\s*uid/,
    )
    expect(SAFE_MASTER_COLLECTION_ACCESS['lib/firestore-helpers.ts::fetchCardTypesByIds'].evidence)
      .toBe('point-ownership-filter')
    expect(SAFE_MASTER_COLLECTION_ACCESS['lib/firestore-helpers.ts::fetchCardTypesByIds'].note.trim())
      .not.toBe('')
    expect(Object.keys(DEFERRED_DEBT_ALLOWLIST)).toEqual([])
  })

  it('Guard B: client SDK collection(db, ...) calls are outside the Admin SDK scanner', () => {
    expect(findMasterCollectionAccesses("collection(db, 'decks')", 'client.ts')).toEqual([])
    expect(findMasterCollectionAccesses("db.collection('decks')", 'server.ts')).toMatchObject([
      { collection: 'decks', key: 'server.ts::decks' },
    ])
  })
})
