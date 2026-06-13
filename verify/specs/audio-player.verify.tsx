import type { ComponentProps } from 'react'
import { z } from 'zod'
import { AudioPlayer } from '@/components/preview/AudioPlayer'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type AudioPlayerProps = ComponentProps<typeof AudioPlayer>

const AUDIO_URL = 'https://storage.googleapis.com/ankiflow/audio/word.mp3'

// Audio stub instances — chỉ tồn tại trong vitest (verify/test-setup.ts)
function audioInstances(): Array<{ src: string }> | null {
  const g = globalThis as unknown as { __verifyAudioInstances?: Array<{ src: string }> }
  return g.__verifyAudioInstances ?? null
}

// Spy cho onRegenerate — reset trong act
const regenSpy = { count: 0 }
const recordRegen = () => {
  regenSpy.count++
}
const noop = () => undefined

function clickButtonByText(root: HTMLElement, text: string): void {
  const btn = Array.from(root.querySelectorAll('button')).find(b =>
    b.textContent?.includes(text)
  )
  if (!btn) throw new Error(`không tìm thấy button "${text}"`)
  btn.click()
}

registerUnit<AudioPlayerProps>({
  id: 'AudioPlayer',
  title: 'AudioPlayer',
  description: 'Player audio TTS: Play/Stop + Regenerate; disabled khi không có url/loading.',
  kind: 'component',
  render: props => <AudioPlayer {...props} />,
  propsSchema: z.object({
    audioUrl: z.string().nullable(),
    onRegenerate: fn<() => void>(),
    loading: z.boolean().optional(),
    label: z.string().optional(),
  }),
  fixtures: [
    {
      id: 'with-audio',
      description: 'Có audio url — nút Play enabled.',
      props: { audioUrl: AUDIO_URL, onRegenerate: noop },
    },
    {
      id: 'no-audio',
      description: 'audioUrl null — nút Play disabled, Regenerate vẫn bấm được.',
      props: { audioUrl: null, onRegenerate: noop },
    },
    {
      id: 'loading',
      description: 'Đang generate — cả hai nút disabled, text "Generating...".',
      props: { audioUrl: AUDIO_URL, onRegenerate: noop, loading: true },
    },
    {
      id: 'act-play',
      description: 'Act: click Play → trạng thái playing, nút đổi thành Stop, Audio nhận đúng url.',
      props: { audioUrl: AUDIO_URL, onRegenerate: noop },
      act: async ctx => {
        clickButtonByText(ctx.root, 'Play')
        await ctx.wait(0)
      },
    },
    {
      id: 'act-regenerate',
      description: 'Act: click Regenerate → onRegenerate gọi 1 lần.',
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
      description: 'Probe: click Play khi audioUrl null — inert, không crash, không tạo Audio.',
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
      description: 'Nút Play disabled khi và chỉ khi không có url hoặc loading',
      check: ({ root, props }) => {
        const playBtn = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(b =>
          /Play|Stop/.test(b.textContent ?? '')
        )
        if (!playBtn) return 'không tìm thấy nút Play/Stop'
        const expected = !props.audioUrl || Boolean(props.loading)
        return playBtn.disabled === expected || `disabled=${playBtn.disabled}, expected=${expected}`
      },
    },
    {
      id: 'label-visible',
      description: 'Label hiển thị (mặc định "Audio")',
      check: ({ root, props }) =>
        (root.textContent ?? '').includes(props.label ?? 'Audio') || 'không thấy label',
    },
    {
      id: 'loading-text',
      description: 'Loading: hiển thị "Generating...", nút Regenerate disabled',
      onlyFixtures: ['loading'],
      check: ({ root }) => {
        if (!(root.textContent ?? '').includes('Generating...')) return 'không thấy "Generating..."'
        const regen = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find(b =>
          b.textContent?.includes('Generating...')
        )
        return regen?.disabled === true || 'nút regenerate không disabled'
      },
    },
    {
      id: 'play-starts-playback',
      description: 'Play: contract playing=true, nút thành Stop, Audio stub nhận đúng url (vitest)',
      onlyFixtures: ['act-play'],
      check: ({ root, contract }) => {
        if (contract.playing !== 'true') return `contract.playing="${contract.playing}"`
        if (!(root.textContent ?? '').includes('Stop')) return 'nút không đổi thành Stop'
        const instances = audioInstances()
        if (instances === null) return true // browser: không có stub — bỏ qua kiểm tra src
        const last = instances[instances.length - 1]
        return last?.src === AUDIO_URL || `Audio src="${last?.src}"`
      },
    },
    {
      id: 'regenerate-fires',
      description: 'Regenerate gọi onRegenerate đúng 1 lần',
      onlyFixtures: ['act-regenerate'],
      check: () => regenSpy.count === 1 || `count=${regenSpy.count}`,
    },
    {
      id: 'no-audio-click-inert',
      description: 'Click Play không url: playing vẫn false, không tạo Audio instance',
      onlyFixtures: ['probe-no-audio-click'],
      check: ({ contract }) => {
        if (contract.playing !== 'false') return `contract.playing="${contract.playing}"`
        const instances = audioInstances()
        if (instances === null) return true
        return instances.length === 0 || `${instances.length} Audio instance được tạo`
      },
    },
  ],
})
