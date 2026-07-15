import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateBatch } from '@/lib/create/batchGenerate'
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
    // Hủy ngay từ đầu → không có kết quả nào được điền.
    expect(results.filter(Boolean)).toHaveLength(0)
  })

  it('途中で abort された後、新しい item の取得を停止', async () => {
    const controller = new AbortController()
    let calls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        calls += 1
        // Abort sau item đầu tiên.
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

    // Concurrency = 3 nên tối đa 3 request khởi động ở đợt đầu; không thêm item mới sau abort.
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
})
