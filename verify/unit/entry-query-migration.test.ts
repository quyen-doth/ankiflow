import { Timestamp, type Firestore } from 'firebase-admin/firestore'
import { describe, expect, it, vi } from 'vitest'
import {
  buildEntryQueryMigrationPlan,
  executeEntryQueryMigration,
  markEntryQuerySchemaReady,
  parseEntryQueryMigrationArgs,
  type EntryQueryMigrationInput,
} from '@/lib/entries/queryMetadataMigration'

const updateTime = Timestamp.fromMillis(1_000)

function input(overrides: Partial<EntryQueryMigrationInput> = {}): EntryQueryMigrationInput {
  return {
    entries: [],
    contentTypes: [],
    ...overrides,
  }
}

describe('Entry query metadata migration plan', () => {
  it('default は dry-run で、--apply だけが write mode を有効化する', () => {
    expect(parseEntryQueryMigrationArgs([])).toEqual({ apply: false, help: false })
    expect(parseEntryQueryMigrationArgs(['--apply'])).toEqual({ apply: true, help: false })
    expect(() => parseEntryQueryMigrationArgs(['--force'])).toThrow('Unknown argument')
  })

  it('metadata が無い Entry を安全な candidate にする', () => {
    const plan = buildEntryQueryMigrationPlan(input({
      entries: [{
        id: 'entry-1',
        path: 'entries/entry-1',
        data: { word: 'Docker', card_type_ids: ['a', 'b'] },
        updateTime,
      }],
    }))

    expect(plan.collisions).toEqual([])
    expect(plan.candidates).toEqual([expect.objectContaining({
      id: 'entry-1',
      metadata: {
        _query_schema_version: 1,
        _query_duplicate_key: 'docker',
        _query_card_count: 2,
      },
      updateTime,
    })])
  })

  it('managed metadata は一致なら skip、不一致なら recompute candidate にする', () => {
    const plan = buildEntryQueryMigrationPlan(input({
      entries: [
        {
          id: 'current',
          path: 'entries/current',
          data: {
            word: 'Current',
            card_type_ids: ['a'],
            _query_schema_version: 1,
            _query_duplicate_key: 'current',
            _query_card_count: 1,
          },
          updateTime,
        },
        {
          id: 'stale',
          path: 'entries/stale',
          data: {
            word: 'Fresh',
            card_type_ids: ['a', 'b'],
            _query_schema_version: 1,
            _query_duplicate_key: 'old',
            _query_card_count: 1,
          },
          updateTime,
        },
      ],
    }))

    expect(plan.unchangedEntries).toBe(1)
    expect(plan.candidates.map(candidate => candidate.id)).toEqual(['stale'])
    expect(plan.candidates[0].metadata).toMatchObject({
      _query_duplicate_key: 'fresh',
      _query_card_count: 2,
    })
  })

  it('legacy/unknown prefix と Content Type field collision を報告し apply 対象にしない', () => {
    const plan = buildEntryQueryMigrationPlan(input({
      entries: [
        {
          id: 'legacy',
          path: 'entries/legacy',
          data: { word: 'Legacy', _query_duplicate_key: 'custom user value' },
          updateTime,
        },
        {
          id: 'unknown',
          path: 'entries/unknown',
          data: {
            word: 'Unknown',
            _query_schema_version: 1,
            _query_duplicate_key: 'unknown',
            _query_card_count: 0,
            _query_future: 'unexpected',
          },
          updateTime,
        },
      ],
      contentTypes: [{
        path: 'user_content_types/custom',
        fieldKeys: ['prompt', '_query_custom'],
      }],
    }))

    expect(plan.candidates).toEqual([])
    expect(plan.collisions.map(collision => ({
      path: collision.path,
      fields: collision.fields,
    }))).toEqual([
      { path: 'entries/legacy', fields: ['_query_duplicate_key'] },
      { path: 'entries/unknown', fields: ['_query_future'] },
      { path: 'user_content_types/custom', fields: ['_query_custom'] },
    ])
  })
})

describe('Entry query metadata migration apply', () => {
  it('collision が 1 件でもあれば write 前に全体を拒否する', async () => {
    const update = vi.fn()
    const db = {
      collection: () => ({ doc: () => ({ update }) }),
    } as unknown as Firestore

    await expect(executeEntryQueryMigration(db, {
      scannedEntries: 1,
      scannedContentTypes: 0,
      unchangedEntries: 0,
      candidates: [],
      collisions: [{ path: 'entries/1', fields: ['_query_x'], reason: 'collision' }],
    })).rejects.toThrow('collisions remain')
    expect(update).not.toHaveBeenCalled()
  })

  it('snapshot updateTime を precondition として渡す', async () => {
    const update = vi.fn(async () => undefined)
    const db = {
      collection: () => ({ doc: () => ({ update }) }),
    } as unknown as Firestore

    const result = await executeEntryQueryMigration(db, {
      scannedEntries: 1,
      scannedContentTypes: 0,
      unchangedEntries: 0,
      collisions: [],
      candidates: [{
        id: 'entry-1',
        path: 'entries/entry-1',
        metadata: {
          _query_schema_version: 1,
          _query_duplicate_key: 'docker',
          _query_card_count: 1,
        },
        updateTime,
      }],
    })

    expect(result).toEqual({ updated: 1, failures: [] })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ _query_duplicate_key: 'docker' }),
      { lastUpdateTime: updateTime },
    )
  })

  it('ready marker と settings updated_at を同じ時刻で保存する', async () => {
    const set = vi.fn(async () => undefined)
    const db = {
      collection: () => ({ doc: () => ({ set }) }),
    } as unknown as Firestore
    const now = new Date('2026-07-25T00:00:00.000Z')

    await markEntryQuerySchemaReady(db, now)

    expect(set).toHaveBeenCalledWith({
      entry_query_schema_version: 1,
      entry_query_schema_ready_at: now,
      updated_at: now,
    }, { merge: true })
  })
})
