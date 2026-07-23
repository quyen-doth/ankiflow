import type { ComponentProps } from 'react'
import { z } from 'zod'
import { AudioPlayer } from '@/components/preview/AudioPlayer'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type AudioPlayerProps = ComponentProps<typeof AudioPlayer>

const AUDIO_URL = 'https://storage.googleapis.com/ankiflow/audio/word.mp3'

// 検証用コメント。
function audioInstances(): Array<{ src: string }> | null {
  const g = globalThis as unknown as { __verifyAudioInstances?: Array<{ src: string }> }
  return g.__verifyAudioInstances ?? null
}

// onRegenerate 用 spy — act 内で reset
const regenSpy = { count: 0 }
const recordRegen = () => {
  regenSpy.count++
}
const noop = () => undefined

function clickButtonByText(root: HTMLElement, text: string): void {
  const btn = Array.from(root.querySelectorAll('button')).find(b =>
    b.textContent?.includes(text)
  )
  if (!btn) throw new Error(`button が見つかりません "${text}"`)
  btn.click()
}

registerUnit<AudioPlayerProps>({
  id: 'AudioPlayer',
  title: 'AudioPlayer',
  description: '検証ケース。',
  kind: 'component',
  render: props => <AudioPlayer {...props} />,
  propsSchema: z.object({
    audioUrl: z.string().nullable(),
    onRegenerate: fn<() => void>(),
    loading: z.boolean().optional(),
    regenerateDisabled: z.boolean().optional(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'with-audio',
      description: '検証ケース。',
      props: { audioUrl: AUDIO_URL, onRegenerate: noop },
    },
    {
      id: 'no-audio',
      description: '検証ケース。',
      props: { audioUrl: null, onRegenerate: noop },
    },
    {
      id: 'loading',
      description: '生成中 — 2 つのボタンは disabled、text は "Generating..."。',
      props: { audioUrl: AUDIO_URL, onRegenerate: noop, loading: true },
    },
    {
      id: 'regenerate-disabled',
      description: '利用されない capability は再生成を無効化する。',
      props: {
        audioUrl: AUDIO_URL,
        onRegenerate: noop,
        regenerateDisabled: true,
      },
    },
    {
      id: 'act-play',
      description: '検証ケース。',
      props: { audioUrl: AUDIO_URL, onRegenerate: noop },
      act: async ctx => {
        clickButtonByText(ctx.root, 'Play')
        await ctx.wait(0)
      },
    },
    {
      id: 'act-regenerate',
      description: '検証ケース。',
      props: { audioUrl: AUDIO_URL, onRegenerate: recordRegen },
      act: async ctx => {
        regenSpy.count = 0
        clickButtonByText(ctx.root, 'Regenerate')
        await ctx.wait(0)
      },
    },
    {
      id: 'probe-no-audio-click',
      probe: true,
      description: '検証ケース。',
      props: { audioUrl: null, onRegenerate: noop },
      act: async ctx => {
        const before = audioInstances()?.length ?? 0
        clickButtonByText(ctx.root, 'Play')
        await ctx.wait(0)
        void before
      },
    },
  ],
  invariants: [
    {
      id: 'play-disabled-iff-unavailable',
      description: '検証ケース。',
      check: ({ root, props }) => {
        const playBtn = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(b =>
          /Play|Stop/.test(b.textContent ?? '')
        )
        if (!playBtn) return '要素が見つかりません'
        const expected = !props.audioUrl || Boolean(props.loading)
        return playBtn.disabled === expected || `disabled=${playBtn.disabled}, expected=${expected}`
      },
    },
    {
      id: 'label-visible',
      description: 'title が表示される (default は "Native pronunciation")',
      check: ({ root, props }) =>
        (root.textContent ?? '').includes(props.title ?? 'Native pronunciation') || '表示が見つかりません',
    },
    {
      id: 'loading-text',
      description: 'Loading: "Generating..." を表示し、Regenerate ボタンは disabled',
      onlyFixtures: ['loading'],
      check: ({ root }) => {
        if (!(root.textContent ?? '').includes('Generating...')) return '見つかりません "Generating..."'
        const regen = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(b =>
          b.textContent?.includes('Generating...')
        )
        return regen?.disabled === true || 'regenerate button が disabled ではありません'
      },
    },
    {
      id: 'regenerate-disabled-state',
      description: 'regenerateDisabled の場合は再生成ボタンを無効化する',
      onlyFixtures: ['regenerate-disabled'],
      check: ({ root }) => {
        const regenerate = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(button =>
          button.textContent?.includes('Regenerate')
        )
        return regenerate?.disabled === true || 'regenerate button が disabled ではありません'
      },
    },
    {
      id: 'play-starts-playback',
      description: '検証ケース。',
      onlyFixtures: ['act-play'],
      check: ({ root, contract }) => {
        if (contract.playing !== 'true') return `contract.playing="${contract.playing}"`
        if (!(root.textContent ?? '').includes('Stop')) return 'button が Stop に変わりません'
        const instances = audioInstances()
        if (instances === null) return true // 検証用コメント。
        const last = instances[instances.length - 1]
        return last?.src === AUDIO_URL || `Audio src="${last?.src}"`
      },
    },
    {
      id: 'regenerate-fires',
      description: '検証ケース。',
      onlyFixtures: ['act-regenerate'],
      check: () => regenSpy.count === 1 || `count=${regenSpy.count}`,
    },
    {
      id: 'no-audio-click-inert',
      description: '検証ケース。',
      onlyFixtures: ['probe-no-audio-click'],
      check: ({ contract }) => {
        if (contract.playing !== 'false') return `contract.playing="${contract.playing}"`
        const instances = audioInstances()
        if (instances === null) return true
        return instances.length === 0 || `${instances.length} Audio instance 作成されています`
      },
    },
  ],
})
