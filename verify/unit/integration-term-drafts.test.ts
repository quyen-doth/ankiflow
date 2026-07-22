import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 検証用コメント。
 * 検証用コメント。
 */

interface EntryDoc {
  id: string
  data: Record<string, unknown>
}

const { entryDocs, deckDocs, setDocs } = vi.hoisted(() => ({
  entryDocs: [] as EntryDoc[],
  deckDocs: [] as EntryDoc[],
  setDocs: [] as { ref: { col: string; id: string }; data: Record<string, unknown> }[],
}))

vi.mock('@/lib/firebase-admin', () => ({
  getAdminDb: () => ({
    collection: (name: string) => ({
      where: () => ({
        // entries: .where(user_id).get() — 1段; decks: .where(user_id).where(form_type).limit(1).get() — 複数段
        get: async () => {
          const docs = name === 'entries' ? entryDocs : deckDocs
          return { docs: docs.map((d) => ({ id: d.id, data: () => d.data })), empty: docs.length === 0 }
        },
        where: () => ({
          limit: () => ({
            get: async () => ({
              docs: deckDocs.map((d) => ({ id: d.id, data: () => d.data })),
              empty: deckDocs.length === 0,
            }),
          }),
        }),
      }),
      doc: (id?: string) => ({ col: name, id: id ?? `auto-${setDocs.length}` }),
    }),
    batch: () => ({
      set: (ref: { col: string; id: string }, data: Record<string, unknown>) => setDocs.push({ ref, data }),
      commit: async () => {},
    }),
  }),
}))

import { POST } from '@/app/api/integrations/term-drafts/route'

const ORIGINAL_TOKEN = process.env.INTEGRATION_TOKEN
const ORIGINAL_UID = process.env.INTEGRATION_TARGET_UID

function makeReq(opts: { token?: string | null; body?: unknown }) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.token !== null && opts.token !== undefined) headers['x-integration-token'] = opts.token
  return new Request('http://localhost:3000/api/integrations/term-drafts', {
    method: 'POST',
    headers,
    body: JSON.stringify(opts.body ?? {}),
  })
}

const VALID_ITEM = {
  term: 'Kubernetes',
  language: 'en',
  source_url: 'https://example.com/k8s',
  source_title: 'Intro to K8s',
}

beforeEach(() => {
  process.env.INTEGRATION_TOKEN = 'secret-token-123'
  process.env.INTEGRATION_TARGET_UID = 'target-uid-1'
  entryDocs.length = 0
  deckDocs.length = 0
  setDocs.length = 0
})

afterEach(() => {
  process.env.INTEGRATION_TOKEN = ORIGINAL_TOKEN
  process.env.INTEGRATION_TARGET_UID = ORIGINAL_UID
})

describe('POST /api/integrations/term-drafts — auth', () => {
  it('検証ケース', async () => {
    const res = await POST(makeReq({ token: 'secret-token-123', body: { source: 'knowledge-hub', items: [VALID_ITEM] } }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.created).toHaveLength(1)
    expect(body.skipped).toEqual([])
    expect(setDocs[0].data).toMatchObject({
      user_id: 'target-uid-1',
      term: 'Kubernetes',
      status: 'draft',
      form_type: 'form_it',
      category_id: null,
      integration_source: 'knowledge-hub',
    })
  })

  it('検証ケース', async () => {
    const res = await POST(makeReq({ token: 'wrong-token', body: { source: 'knowledge-hub', items: [VALID_ITEM] } }))
    expect(res.status).toBe(401)
    expect(setDocs).toHaveLength(0)
  })

  it('不足しています', async () => {
    const res = await POST(makeReq({ token: null, body: { source: 'knowledge-hub', items: [VALID_ITEM] } }))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/integrations/term-drafts — validate body', () => {
  it('任意の BCP 47 language を canonicalize して保存', async () => {
    const res = await POST(makeReq({
      token: 'secret-token-123',
      body: { source: 'knowledge-hub', items: [{ ...VALID_ITEM, language: 'pt_br' }] },
    }))
    expect(res.status).toBe(200)
    expect(setDocs[0].data.language).toBe('pt-BR')
  })

  it('無効な language code → 400', async () => {
    const res = await POST(makeReq({
      token: 'secret-token-123',
      body: { source: 'knowledge-hub', items: [{ ...VALID_ITEM, language: 'not a language' }] },
    }))
    expect(res.status).toBe(400)
  })

  it('不足しています', async () => {
    const res = await POST(
      makeReq({
        token: 'secret-token-123',
        body: { source: 'knowledge-hub', items: [{ term: 'x', language: 'en', source_title: 't' }] },
      }),
    )
    expect(res.status).toBe(400)
  })

  it('items が空なら 400', async () => {
    const res = await POST(makeReq({ token: 'secret-token-123', body: { source: 'knowledge-hub', items: [] } }))
    expect(res.status).toBe(400)
  })

  it('items > 20 → 400', async () => {
    const items = Array.from({ length: 21 }, (_, i) => ({ ...VALID_ITEM, term: `term-${i}` }))
    const res = await POST(makeReq({ token: 'secret-token-123', body: { source: 'knowledge-hub', items } }))
    expect(res.status).toBe(400)
  })

  it('検証ケース', async () => {
    const res = await POST(
      makeReq({
        token: 'secret-token-123',
        body: { source: 'knowledge-hub', items: [{ ...VALID_ITEM, context_quote: 'x'.repeat(201) }] },
      }),
    )
    expect(res.status).toBe(400)
  })
})

describe('POST /api/integrations/term-drafts — duplicate', () => {
  it('検証ケース', async () => {
    entryDocs.push({ id: 'e1', data: { term: 'kubernetes' } })

    const res = await POST(
      makeReq({ token: 'secret-token-123', body: { source: 'knowledge-hub', items: [{ ...VALID_ITEM, term: '  Kubernetes  ' }] } }),
    )
    const body = await res.json()
    expect(body.created).toEqual([])
    // 検証用コメント。
    expect(body.skipped).toEqual([{ term: 'Kubernetes', reason: 'duplicate' }])
    expect(setDocs).toHaveLength(0)
  })

  it('検証ケース', async () => {
    entryDocs.push({ id: 'e1', data: { term: 'Kubernetes' } })
    const res = await POST(makeReq({ token: 'secret-token-123', body: { source: 'knowledge-hub', items: [VALID_ITEM] } }))
    const body = await res.json()
    expect(body.created).toEqual([])
    expect(body.skipped[0].reason).toBe('duplicate')
  })

  it('検証ケース', async () => {
    const res = await POST(
      makeReq({
        token: 'secret-token-123',
        body: { source: 'knowledge-hub', items: [VALID_ITEM, { ...VALID_ITEM, term: 'kubernetes' }] },
      }),
    )
    const body = await res.json()
    expect(body.created).toHaveLength(1)
    expect(body.skipped).toHaveLength(1)
  })
})

describe('POST /api/integrations/term-drafts — default deck', () => {
  it('検証ケース', async () => {
    deckDocs.push({ id: 'd1', data: { anki_deck_name: 'Custom::IT', default_card_type_ids: ['ct_a', 'ct_b'] } })

    await POST(makeReq({ token: 'secret-token-123', body: { source: 'knowledge-hub', items: [VALID_ITEM] } }))

    expect(setDocs[0].data).toMatchObject({ anki_deck: 'Custom::IT', card_type_ids: ['ct_a', 'ct_b'] })
  })

  it('検証ケース', async () => {
    await POST(makeReq({ token: 'secret-token-123', body: { source: 'knowledge-hub', items: [VALID_ITEM] } }))

    expect(setDocs[0].data).toMatchObject({ anki_deck: 'Vocabulary::IT', card_type_ids: [] })
  })
})
