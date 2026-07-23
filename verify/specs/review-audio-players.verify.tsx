import type { ComponentProps } from 'react'
import { z } from 'zod'
import { ReviewAudioPlayers } from '@/components/review/FlashcardReviewLayout'
import { registerUnit } from '@/verify/core/registry'
import { fn } from '@/verify/core/schema-helpers'

type ReviewAudioPlayersProps = ComponentProps<typeof ReviewAudioPlayers>

const AUDIO_URL = 'data:audio/mp3;base64,TUFJTg=='
const EXAMPLE_AUDIO_URL = 'data:audio/mp3;base64,RVhBTVBMRQ=='
const noop = () => undefined

registerUnit<ReviewAudioPlayersProps>({
  id: 'ReviewAudioPlayers',
  title: 'ReviewAudioPlayers',
  description: '選択 template と保存済み URL に応じて例文音声 player を表示する。',
  kind: 'component',
  render: props => <ReviewAudioPlayers {...props} />,
  propsSchema: z.object({
    audioUrl: z.string().nullable(),
    audioLoading: z.boolean(),
    onAudioRegenerate: fn<() => void>(),
    audioSubtitle: z.string().optional(),
    audioExampleUrl: z.string().nullable(),
    audioExampleLoading: z.boolean(),
    onAudioExampleRegenerate: fn<() => void>(),
    usesExampleAudio: z.boolean(),
  }),
  fixtures: [
    {
      id: 'main-only',
      description: '例文 audio を使わない template は通常音声だけ表示する。',
      props: {
        audioUrl: AUDIO_URL,
        audioLoading: false,
        onAudioRegenerate: noop,
        audioExampleUrl: null,
        audioExampleLoading: false,
        onAudioExampleRegenerate: noop,
        usesExampleAudio: false,
      },
    },
    {
      id: 'uses-example',
      description: '選択 template が利用する場合は未生成でも例文 audio player を表示する。',
      props: {
        audioUrl: AUDIO_URL,
        audioLoading: false,
        onAudioRegenerate: noop,
        audioSubtitle: 'Google TTS · Japanese',
        audioExampleUrl: null,
        audioExampleLoading: false,
        onAudioExampleRegenerate: noop,
        usesExampleAudio: true,
      },
    },
    {
      id: 'existing-example',
      description: '選択解除後も保存済み例文 audio player を表示して再生可能にする。',
      props: {
        audioUrl: AUDIO_URL,
        audioLoading: false,
        onAudioRegenerate: noop,
        audioExampleUrl: EXAMPLE_AUDIO_URL,
        audioExampleLoading: false,
        onAudioExampleRegenerate: noop,
        usesExampleAudio: false,
      },
    },
    {
      id: 'probe-no-audio',
      probe: true,
      description: 'Probe: URL が無く capability も未使用なら例文 player を表示しない。',
      props: {
        audioUrl: null,
        audioLoading: false,
        onAudioRegenerate: noop,
        audioExampleUrl: null,
        audioExampleLoading: false,
        onAudioExampleRegenerate: noop,
        usesExampleAudio: false,
      },
    },
  ],
  invariants: [
    {
      id: 'main-player-always-visible',
      description: '通常音声 player はすべての状態で表示する',
      check: ({ root }) =>
        (root.textContent ?? '').includes('Native pronunciation')
        || '通常音声 player がありません',
    },
    {
      id: 'template-usage-shows-example-player',
      description: '選択 template が例文音声を使う場合は player を表示する',
      onlyFixtures: ['uses-example'],
      check: ({ root, contract }) => {
        if (contract.showexampleaudio !== 'true') {
          return `showExampleAudio="${contract.showexampleaudio}"`
        }
        return (root.textContent ?? '').includes('Example audio')
          || '例文 audio player がありません'
      },
    },
    {
      id: 'existing-url-keeps-example-player',
      description: '保存済み URL がある場合は template 選択解除後も player を保持する',
      onlyFixtures: ['existing-example'],
      check: ({ root, contract }) => {
        if (contract.hasexampleaudio !== 'true') {
          return `hasExampleAudio="${contract.hasexampleaudio}"`
        }
        return (root.textContent ?? '').includes('Example audio')
          || '保存済み例文 audio player がありません'
      },
    },
    {
      id: 'unused-empty-example-hidden',
      description: '未使用かつ未生成なら例文 audio player を表示しない',
      onlyFixtures: ['main-only', 'probe-no-audio'],
      check: ({ root, contract }) => {
        if (contract.showexampleaudio !== 'false') {
          return `showExampleAudio="${contract.showexampleaudio}"`
        }
        return !(root.textContent ?? '').includes('Example audio')
          || '不要な例文 audio player が表示されています'
      },
    },
    {
      id: 'unselected-existing-regeneration-disabled',
      description: '未選択 template の保存済み audio は再生成を無効化する',
      onlyFixtures: ['existing-example'],
      check: ({ root }) => {
        const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
          .filter(button => button.textContent?.includes('Regenerate'))
        return buttons[1]?.disabled === true
          || '例文 audio の再生成ボタンが disabled ではありません'
      },
    },
  ],
})
