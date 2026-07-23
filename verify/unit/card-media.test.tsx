import { createElement, useEffect, useState, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FormType, type Entry } from '@/types'

const { mediaFlags, warning } = vi.hoisted(() => ({
  mediaFlags: {
    effectiveTts: true,
    effectiveUnsplash: false,
  },
  warning: vi.fn(),
}))

vi.mock('@/hooks/useEffectiveMediaFlags', () => ({
  useEffectiveMediaFlags: () => ({
    ...mediaFlags,
    loading: false,
  }),
}))

vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ warning }),
}))

import { useCardMedia } from '@/hooks/useCardMedia'

type CardMediaResult = ReturnType<typeof useCardMedia>

interface HarnessProps {
  initialEntry: Partial<Entry>
  usesExampleAudio: boolean
}

const latestMedia: { current: CardMediaResult | null } = { current: null }

function captureMedia(media: CardMediaResult) {
  latestMedia.current = media
}

function CardMediaHarness({ initialEntry, usesExampleAudio }: HarnessProps) {
  const [entry, setEntry] = useState<Partial<Entry>>(initialEntry)
  const media = useCardMedia(entry, setEntry, true, usesExampleAudio)
  useEffect(() => {
    captureMedia(media)
  }, [media])
  return null
}

const ENTRY: Partial<Entry> = {
  form_type: FormType.LANGUAGE,
  language: 'ja',
  example_sentence: '毎朝パンを食べる。',
}

let container: HTMLDivElement
let root: Root
let fetchMock: ReturnType<typeof vi.fn>

async function renderHarness(
  usesExampleAudio: boolean,
  initialEntry: Partial<Entry> = ENTRY,
) {
  await act(async () => {
    root.render(createElement(CardMediaHarness, { initialEntry, usesExampleAudio }))
  })
}

beforeEach(() => {
  ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  mediaFlags.effectiveTts = true
  mediaFlags.effectiveUnsplash = false
  warning.mockReset()
  latestMedia.current = null
  fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ base64: 'RVhBTVBMRQ==' }),
  } as Response)
  vi.stubGlobal('fetch', fetchMock)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useCardMedia — example audio', () => {
  it('選択 template が audio_example を使わない場合は TTS を呼ばない', async () => {
    await renderHarness(false)

    await act(async () => {
      await vi.runAllTimersAsync()
      await latestMedia.current?.generateExampleAudio()
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(latestMedia.current?.audioExampleUrl).toBeNull()
  })

  it('card type 選択後に gate が true になると例文 TTS を 1 回だけ生成する', async () => {
    await renderHarness(false)
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(fetchMock).not.toHaveBeenCalled()

    await renderHarness(true)
    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith('/api/audio/generate', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        text: '毎朝パンを食べる。',
        language: 'ja',
        filename: 'ankiflow_audio_ex_example.mp3',
      }),
    }))
    expect(latestMedia.current?.audioExampleUrl).toBe('data:audio/mp3;base64,RVhBTVBMRQ==')

    await renderHarness(true)
    await act(async () => {
      await vi.runAllTimersAsync()
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('保存済み audio_example_url がある場合は自動生成しない', async () => {
    await renderHarness(true, {
      ...ENTRY,
      audio_example_url: 'data:audio/mp3;base64,Q0FDSEVE',
    })

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(latestMedia.current?.audioExampleUrl).toBe('data:audio/mp3;base64,Q0FDSEVE')
  })
})
