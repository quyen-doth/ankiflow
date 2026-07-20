import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateBatch } from '@/lib/create/batchGenerate'
import { DEFAULT_CONTENT_TYPES } from '@/lib/contentTypes'
import { getBlueprintForContentType } from '@/lib/create/formBlueprint'
import { FormType, LanguageType } from '@/types'
import type { CardFormBlueprint } from '@/lib/create/formBlueprint'

const apiBlueprint: CardFormBlueprint = {
  formType: FormType.LANGUAGE,
  uiFormType: 'Language',
  coreFields: [{ key: 'word', label: 'Word', type: 'text' }],
  configBlocks: [],
  generate: {
    mode: 'api',
    payload: (v, s) => ({ word: v.word, form_type: FormType.LANGUAGE, language: s.language }),
  },
}

const localBlueprint: CardFormBlueprint = {
  formType: FormType.GENERAL,
  uiFormType: 'General',
  coreFields: [{ key: 'title', label: 'Title', type: 'text' }],
  configBlocks: [],
  generate: {
    mode: 'local',
    content: (v) => ({ title: v.title, word: v.title, meaning_vi: `def of ${v.title}` }),
  },
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('generateBatch — api mode', () => {
  beforeEach(() => {
    // Echo the requested word back as content; fail for the word "boom".
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string) as { word: string }
        if (body.word === 'boom') {
          return { ok: false, json: async () => ({ error: 'kaboom' }) } as Response
        }
        return {
          ok: true,
          json: async () => ({ content: { word: body.word, meaning_vi: `m_${body.word}` } }),
        } as Response
      }),
    )
  })

  it('returns results in the same order as items', async () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const results = await generateBatch(apiBlueprint, items, { language: LanguageType.ENGLISH })
    expect(results.map(r => r.item)).toEqual(items)
    expect(results.every(r => r.ok)).toBe(true)
    expect(results[2].content).toEqual({ word: 'c', meaning_vi: 'm_c' })
  })

  it('calls onProgress once per item', async () => {
    const onProgress = vi.fn()
    const items = ['a', 'b', 'c']
    await generateBatch(apiBlueprint, items, { language: LanguageType.ENGLISH }, { onProgress })
    expect(onProgress).toHaveBeenCalledTimes(3)
    expect(onProgress).toHaveBeenLastCalledWith(3, 3)
  })

  it('marks a failing item ok:false without stopping the batch', async () => {
    const items = ['a', 'boom', 'c']
    const results = await generateBatch(apiBlueprint, items, { language: LanguageType.ENGLISH })
    expect(results.map(r => r.ok)).toEqual([true, false, true])
    expect(results[1].error).toBe('kaboom')
    expect(results[0].ok && results[2].ok).toBe(true)
  })

  it('does not silently default a missing language to English', async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    await generateBatch(apiBlueprint, ['x'], {})
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.language).toBeUndefined()
  })

  it('workspace blueprint の authoritative content_type_id を全 batch request に渡す', async () => {
    const languageDefault = DEFAULT_CONTENT_TYPES.find(contentType => (
      contentType.id === FormType.LANGUAGE
    ))
    if (!languageDefault) throw new Error('Language Content Type default is required')
    const workspaceBlueprint = getBlueprintForContentType({
      ...languageDefault,
      id: 'form_language__user-1',
      created_at: { seconds: 0, nanoseconds: 0, toDate: () => new Date(0) },
      updated_at: { seconds: 0, nanoseconds: 0, toDate: () => new Date(0) },
    })

    await generateBatch(
      workspaceBlueprint,
      ['book', 'pen'],
      { language: LanguageType.ENGLISH },
    )

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    const bodies = fetchMock.mock.calls.map(call => (
      JSON.parse(call[1].body as string) as Record<string, unknown>
    ))
    expect(bodies).toHaveLength(2)
    expect(bodies.every(body => body.content_type_id === 'form_language__user-1')).toBe(true)
  })
})

describe('generateBatch — キャンセル (abort)', () => {
  it('事前に signal が abort されている場合 fetch を呼ばない', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    controller.abort()

    const results = await generateBatch(
      apiBlueprint,
      ['a', 'b', 'c'],
      { language: LanguageType.ENGLISH },
      { signal: controller.signal },
    )

    expect(fetchMock).not.toHaveBeenCalled()
    // 検証用コメント。
    expect(results.filter(Boolean)).toHaveLength(0)
  })

  it('途中で abort された後、新しい item の取得を停止', async () => {
    const controller = new AbortController()
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        calls += 1
        // 検証用コメント。
        if (calls === 1) controller.abort()
        const body = JSON.parse(init.body as string) as { word: string }
        return {
          ok: true,
          json: async () => ({ content: { word: body.word } }),
        } as Response
      }),
    )

    await generateBatch(
      apiBlueprint,
      ['a', 'b', 'c', 'd', 'e'],
      { language: LanguageType.ENGLISH },
      { signal: controller.signal },
    )

    // 検証用コメント。
    expect(calls).toBeLessThanOrEqual(3)
  })
})

describe('generateBatch — local mode', () => {
  it('builds content locally without fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const results = await generateBatch(localBlueprint, ['Photosynthesis', 'Mitosis'], {})
    expect(fetchMock).not.toHaveBeenCalled()
    expect(results.map(r => r.ok)).toEqual([true, true])
    expect(results[0].content).toEqual({
      title: 'Photosynthesis',
      word: 'Photosynthesis',
      meaning_vi: 'def of Photosynthesis',
    })
  })

  it('primary item と shared core fields を同じ values に渡す', async () => {
    const blueprint: CardFormBlueprint = {
      ...localBlueprint,
      primaryFieldKey: 'title',
      coreFields: [
        { key: 'context', label: 'Context', type: 'textarea' },
        { key: 'title', label: 'Title', type: 'text' },
      ],
      generate: {
        mode: 'local',
        content: values => ({ title: values.title, context: values.context }),
      },
    }

    const results = await generateBatch(blueprint, ['Mitosis'], {}, {
      baseValues: { context: 'Cell biology' },
    })

    expect(results[0].content).toEqual({ title: 'Mitosis', context: 'Cell biology' })
  })
})
