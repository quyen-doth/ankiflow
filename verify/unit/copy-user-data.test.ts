import { describe, expect, it } from 'vitest'
import {
  buildCopyPlan,
  buildDocumentIndexes,
  emptyCopySnapshot,
  naturalKeyFor,
  parseCopyUserDataArgs,
  remapDeckForCopy,
  remapEntryForCopy,
  remapReviewEventForCopy,
  resolveMasterTarget,
  type CopyCollection,
  type CopyDocument,
  type CopyOperation,
  type CopySnapshot,
} from '@/scripts/copy-user-data-core'

function document(id: string, data: Record<string, unknown>): CopyDocument {
  return { id, data }
}

function snapshotFromOperations(operations: CopyOperation[]): CopySnapshot {
  const snapshot = emptyCopySnapshot()
  for (const operation of operations) {
    snapshot[operation.collection].push({ id: operation.id, data: operation.data })
  }
  return snapshot
}

function deterministicIdFactory(): (collection: CopyCollection) => string {
  const counts = new Map<CopyCollection, number>()
  return collection => {
    const next = (counts.get(collection) ?? 0) + 1
    counts.set(collection, next)
    return `${collection}-target-${next}`
  }
}

describe('naturalKeyFor', () => {
  it('各 master collection の論理キーを正規化し、必須 field 不足は null にする', () => {
    expect(naturalKeyFor('categories', { name: ' Daily ', form_type: 'FORM_LANGUAGE' }))
      .toBe(JSON.stringify(['daily', 'form_language']))
    expect(naturalKeyFor('topics', { name: 'Frontend', form_type: 'form_it' }))
      .toBe(JSON.stringify(['frontend', 'form_it']))
    expect(naturalKeyFor('decks', { anki_deck_name: ' Language::English ' }))
      .toBe('language::english')
    expect(naturalKeyFor('user_content_types', { code: 'FORM_IT' })).toBe('form_it')
    expect(naturalKeyFor('categories', { name: 'Daily' })).toBeNull()
    expect(naturalKeyFor('decks', {})).toBeNull()
  })

  it('card type は code/form_type が同じでも language が違えば別キーにする', () => {
    const chinese = naturalKeyFor('card_types', {
      code: 'reading_to_word',
      form_type: 'form_language',
      language: 'zh',
    })
    const japanese = naturalKeyFor('card_types', {
      code: 'reading_to_word',
      form_type: 'form_language',
      language: 'ja',
    })
    const neutral = naturalKeyFor('card_types', {
      code: 'reading_to_word',
      form_type: 'form_language',
      language: null,
    })

    expect(chinese).not.toBe(japanese)
    expect(chinese).not.toBe(neutral)
    expect(japanese).not.toBe(neutral)
  })

  it('entry は word/term/title の最初の非空値を normalizeTerm で正規化する', () => {
    expect(naturalKeyFor('entries', { word: '  Hello ' })).toBe('hello')
    expect(naturalKeyFor('entries', { word: '', term: '  TypeScript ' })).toBe('typescript')
    expect(naturalKeyFor('entries', { title: 'FSRS' })).toBe('fsrs')
    expect(naturalKeyFor('entries', {})).toBeNull()
  })
})

describe('resolveMasterTarget', () => {
  const source = document('source-category', {
    name: 'Daily',
    form_type: 'form_language',
  })

  it('copied_from が一致する target を自然キーより優先して reuse する', () => {
    const indexes = buildDocumentIndexes('categories', [
      document('natural-target', { name: 'Daily', form_type: 'form_language' }),
      document('copied-target', {
        name: 'Renamed',
        form_type: 'form_language',
        copied_from: 'source-category',
      }),
    ])

    expect(resolveMasterTarget('categories', source, indexes, 'new-target')).toEqual({
      action: 'reuse',
      targetId: 'copied-target',
    })
  })

  it('copied_from がなくても自然キー一致なら既存 target を reuse する', () => {
    const indexes = buildDocumentIndexes('categories', [
      document('existing-target', { name: ' DAILY ', form_type: 'FORM_LANGUAGE' }),
    ])

    expect(resolveMasterTarget('categories', source, indexes, 'new-target')).toEqual({
      action: 'reuse',
      targetId: 'existing-target',
    })
  })

  it('一致がなければ指定された新規 ID で create する', () => {
    const indexes = buildDocumentIndexes('categories', [])
    expect(resolveMasterTarget('categories', source, indexes, 'new-target')).toEqual({
      action: 'create',
      targetId: 'new-target',
    })
  })
})

describe('remapDeckForCopy', () => {
  it('card type 配列と category FK を target ID に remap する', () => {
    const result = remapDeckForCopy({
      default_card_type_ids: ['ct-a', 'ct-b'],
      default_category_id: 'cat-a',
      display_name: 'Deck',
    }, {
      cardTypeIds: new Map([['ct-a', 'target-ct-a'], ['ct-b', 'target-ct-b']]),
      categoryIds: new Map([['cat-a', 'target-cat-a']]),
    })

    expect(result.data).toMatchObject({
      default_card_type_ids: ['target-ct-a', 'target-ct-b'],
      default_category_id: 'target-cat-a',
      display_name: 'Deck',
    })
    expect(result.warnings).toEqual([])
  })

  it('解決できない FK は drop/null にして warning を返す', () => {
    const result = remapDeckForCopy({
      default_card_type_ids: ['ct-found', 'ct-missing'],
      default_category_id: 'cat-missing',
    }, {
      cardTypeIds: new Map([['ct-found', 'target-ct']]),
      categoryIds: new Map(),
    })

    expect(result.data.default_card_type_ids).toEqual(['target-ct'])
    expect(result.data.default_category_id).toBeNull()
    expect(result.warnings).toEqual([
      'default_card_type_ids: unresolved reference "ct-missing" was dropped.',
      'default_category_id: unresolved reference "cat-missing" was replaced with null.',
    ])
  })
})

describe('remapEntryForCopy', () => {
  const reviewState = {
    due_date: '2026-08-01T00:00:00.000Z',
    interval_days: 12,
    fsrs: { stability: 8.5, difficulty: 4.2, state: 2 },
  }

  it('synced entry の Anki link を reset し、FK を remap して SRS/metadata を保持する', () => {
    const createdAt = { seconds: 10, nanoseconds: 20 }
    const result = remapEntryForCopy({
      user_id: 'source-user',
      word: 'hello',
      form_type: 'form_language',
      category_id: 'cat-a',
      card_type_ids: ['ct-a', 'ct-missing'],
      topic_ids: ['topic-a'],
      anki_note_ids: [101, 102],
      anki_deck: 'Language::English',
      status: 'synced',
      review_state: reviewState,
      output_language: 'vi',
      integration_source: 'knowledge-hub',
      source_url: 'https://example.com/source',
      created_at: createdAt,
    }, {
      categoryIds: new Map([['cat-a', 'target-cat']]),
      cardTypeIds: new Map([['ct-a', 'target-ct']]),
      topicIds: new Map([['topic-a', 'target-topic']]),
    }, 'target-user')

    expect(result.data).toMatchObject({
      user_id: 'target-user',
      form_type: 'form_language',
      category_id: 'target-cat',
      card_type_ids: ['target-ct'],
      topic_ids: ['target-topic'],
      anki_note_ids: [],
      anki_deck: 'Language::English',
      status: 'reviewed',
      review_state: reviewState,
      output_language: 'vi',
      integration_source: 'knowledge-hub',
      source_url: 'https://example.com/source',
      created_at: createdAt,
    })
    expect(result.data.review_state).toEqual(reviewState)
    expect(result.warnings).toEqual([
      'card_type_ids: unresolved reference "ct-missing" was dropped.',
    ])
  })

  it('draft status は変更しない', () => {
    const result = remapEntryForCopy({ status: 'draft' }, {
      categoryIds: new Map(),
      cardTypeIds: new Map(),
      topicIds: new Map(),
    }, 'target-user')

    expect(result.data.status).toBe('draft')
  })
})

describe('remapReviewEventForCopy', () => {
  it('copy 対象 entry の ID と user_id を remap する', () => {
    expect(remapReviewEventForCopy({
      user_id: 'source-user',
      entry_id: 'entry-source',
      kind: 'rating',
      rating: 'good',
      created_at: '2026-07-01T00:00:00.000Z',
    }, new Map([['entry-source', 'entry-target']]), 'target-user')).toEqual({
      user_id: 'target-user',
      entry_id: 'entry-target',
      kind: 'rating',
      rating: 'good',
      created_at: '2026-07-01T00:00:00.000Z',
    })
  })

  it('entry ID が copy map にない event は null にする', () => {
    expect(remapReviewEventForCopy(
      { entry_id: 'entry-skipped' },
      new Map(),
      'target-user',
    )).toBeNull()
  })
})

describe('parseCopyUserDataArgs', () => {
  it('default は dry-run で、明示した --apply だけ write mode にする', () => {
    expect(parseCopyUserDataArgs([
      '--from', 'user-a', '--to', 'user-b', '--mode', 'full',
    ])).toEqual({
      fromUid: 'user-a',
      toUid: 'user-b',
      mode: 'full',
      apply: false,
      help: false,
    })
    expect(parseCopyUserDataArgs([
      '--from', 'user-a', '--to', 'admin', '--mode', 'master', '--apply',
    ])).toMatchObject({ mode: 'master', apply: true })
  })

  it('同一 UID、不正 mode、未知引数を拒否する', () => {
    expect(() => parseCopyUserDataArgs([
      '--from', 'same', '--to', 'same', '--mode', 'full',
    ])).toThrow('--from and --to must be different')
    expect(() => parseCopyUserDataArgs([
      '--from', 'a', '--to', 'b', '--mode', 'unknown',
    ])).toThrow('--mode must be "full" or "master"')
    expect(() => parseCopyUserDataArgs([
      '--from', 'a', '--to', 'b', '--mode', 'full', '--force',
    ])).toThrow('Unknown argument(s): --force')
  })
})

describe('buildCopyPlan', () => {
  function completeSourceSnapshot(): CopySnapshot {
    const source = emptyCopySnapshot()
    source.user_content_types.push(document('content-a', { code: 'form_language', name: 'Language' }))
    source.categories.push(document('cat-a', { name: 'Daily', form_type: 'form_language' }))
    source.card_types.push(document('ct-a', {
      code: 'word_to_meaning',
      form_type: 'form_language',
      language: null,
    }))
    source.topics.push(document('topic-a', { name: 'Frontend', form_type: 'form_it' }))
    source.decks.push(document('deck-a', {
      anki_deck_name: 'Language::English',
      default_category_id: 'cat-a',
      default_card_type_ids: ['ct-a'],
    }))
    source.entries.push(document('entry-a', {
      word: 'Hello',
      language: 'en',
      form_type: 'form_language',
      category_id: 'cat-a',
      card_type_ids: ['ct-a'],
      topic_ids: ['topic-a'],
      anki_note_ids: [123],
      status: 'synced',
      review_state: { due_date: '2026-08-01', fsrs: { stability: 3 } },
      created_at: 'source-created-at',
    }))
    source.review_events.push(document('event-a', {
      entry_id: 'entry-a',
      kind: 'rating',
      rating: 'good',
      created_at: 'source-event-at',
    }))
    return source
  }

  it('master FK → entry FK → review event を順番に remap し、再実行は zero-create になる', () => {
    const now = new Date('2026-07-17T00:00:00.000Z')
    const source = completeSourceSnapshot()
    const first = buildCopyPlan({
      mode: 'full',
      targetUid: 'target-user',
      source,
      target: emptyCopySnapshot(),
      now,
      createId: deterministicIdFactory(),
    })

    expect(first.operations).toHaveLength(7)
    const category = first.operations.find(operation => operation.collection === 'categories')
    const cardType = first.operations.find(operation => operation.collection === 'card_types')
    const topic = first.operations.find(operation => operation.collection === 'topics')
    const deck = first.operations.find(operation => operation.collection === 'decks')
    const entry = first.operations.find(operation => operation.collection === 'entries')
    const event = first.operations.find(operation => operation.collection === 'review_events')
    expect(deck?.data).toMatchObject({
      default_category_id: category?.id,
      default_card_type_ids: [cardType?.id],
      user_id: 'target-user',
      copied_from: 'deck-a',
      copied_at: now,
      updated_at: now,
    })
    expect(entry?.data).toMatchObject({
      category_id: category?.id,
      card_type_ids: [cardType?.id],
      topic_ids: [topic?.id],
      anki_note_ids: [],
      status: 'reviewed',
      review_state: source.entries[0].data.review_state,
      created_at: 'source-created-at',
    })
    expect(event?.data).toEqual({
      entry_id: entry?.id,
      kind: 'rating',
      rating: 'good',
      created_at: 'source-event-at',
      user_id: 'target-user',
      copied_from: 'event-a',
    })

    const rerun = buildCopyPlan({
      mode: 'full',
      targetUid: 'target-user',
      source,
      target: snapshotFromOperations(first.operations),
      now: new Date('2026-07-18T00:00:00.000Z'),
      createId: deterministicIdFactory(),
    })
    expect(rerun.operations).toEqual([])
    expect(Object.values(rerun.summary).reduce((count, row) => count + row.created, 0)).toBe(0)
    expect(rerun.summary.entries.reused).toBe(1)
    expect(rerun.summary.review_events.reused).toBe(1)
  })

  it('自然キー重複 entry は skip し、その review event も copy しない', () => {
    const source = emptyCopySnapshot()
    source.entries.push(document('source-entry', { word: ' Hello ', status: 'reviewed' }))
    source.review_events.push(document('source-event', { entry_id: 'source-entry', kind: 'rating' }))
    const target = emptyCopySnapshot()
    target.entries.push(document('target-entry', { word: 'hello', review_state: { due_date: 'keep-me' } }))

    const plan = buildCopyPlan({
      mode: 'full',
      targetUid: 'target-user',
      source,
      target,
      now: new Date('2026-07-17T00:00:00.000Z'),
      createId: deterministicIdFactory(),
    })

    expect(plan.operations).toEqual([])
    expect(plan.summary.entries.skipped).toBe(1)
    expect(plan.summary.review_events.skipped).toBe(1)
    expect(target.entries[0].data.review_state).toEqual({ due_date: 'keep-me' })
  })

  it('既に copied_from で reuse した entry には欠落 review event を回復コピーできる', () => {
    const source = emptyCopySnapshot()
    source.entries.push(document('source-entry', { word: 'Hello' }))
    source.review_events.push(document('source-event', {
      entry_id: 'source-entry',
      kind: 'anki_sync',
      created_at: 'source-event-at',
    }))
    const target = emptyCopySnapshot()
    target.entries.push(document('target-entry', {
      word: 'Hello',
      copied_from: 'source-entry',
    }))

    const plan = buildCopyPlan({
      mode: 'full',
      targetUid: 'target-user',
      source,
      target,
      now: new Date('2026-07-17T00:00:00.000Z'),
      createId: deterministicIdFactory(),
    })

    expect(plan.summary.entries.reused).toBe(1)
    expect(plan.summary.review_events.created).toBe(1)
    expect(plan.operations).toEqual([
      {
        collection: 'review_events',
        id: 'review_events-target-1',
        data: {
          entry_id: 'target-entry',
          kind: 'anki_sync',
          created_at: 'source-event-at',
          user_id: 'target-user',
          copied_from: 'source-event',
        },
      },
    ])
  })

  it('master mode は entries と review_events を計画対象にしない', () => {
    const source = completeSourceSnapshot()
    const plan = buildCopyPlan({
      mode: 'master',
      targetUid: 'target-user',
      source,
      target: emptyCopySnapshot(),
      now: new Date('2026-07-17T00:00:00.000Z'),
      createId: deterministicIdFactory(),
    })

    expect(plan.operations.map(operation => operation.collection)).not.toContain('entries')
    expect(plan.operations.map(operation => operation.collection)).not.toContain('review_events')
    expect(plan.summary.entries).toEqual({ created: 0, reused: 0, skipped: 0 })
    expect(plan.summary.review_events).toEqual({ created: 0, reused: 0, skipped: 0 })
  })
})
