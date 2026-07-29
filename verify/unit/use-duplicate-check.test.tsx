import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useDuplicateCheck,
  type BatchDuplicateResult,
} from '@/hooks/useDuplicateCheck'

let container: HTMLDivElement
let root: Root
let originalFetch: typeof globalThis.fetch

interface HarnessProps {
  words: string[]
  onRun: (pending: Promise<BatchDuplicateResult[]>) => void
}

function Harness({ words, onRun }: HarnessProps) {
  const { checkDuplicatesBatch } = useDuplicateCheck()
  return createElement('button', {
    type: 'button',
    onClick: () => onRun(checkDuplicatesBatch(words)),
  }, 'Check')
}

beforeEach(() => {
  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  originalFetch = globalThis.fetch
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  globalThis.fetch = originalFetch
})

describe('useDuplicateCheck', () => {
  it('100 件を超える browser batch を API limit 単位で並列分割し順序を維持する', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { words: string[] }
      return new Response(JSON.stringify({
        results: body.words.map(word => ({ word, duplicates: [] })),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    globalThis.fetch = fetchMock
    const words = Array.from({ length: 205 }, (_, index) => `word-${index}`)
    const pendingRef: { current: Promise<BatchDuplicateResult[]> | null } = { current: null }
    act(() => root.render(createElement(Harness, {
      words,
      onRun: value => {
        pendingRef.current = value
      },
    })))

    act(() => container.querySelector<HTMLButtonElement>('button')?.click())
    const pending = pendingRef.current
    if (!pending) throw new Error('duplicate check did not start')
    const results = await pending

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.map(call => (
      (JSON.parse(String(call[1]?.body)) as { words: string[] }).words.length
    ))).toEqual([100, 100, 5])
    expect(results.map(result => result.word)).toEqual(words)
  })
})
