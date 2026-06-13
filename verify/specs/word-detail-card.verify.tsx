import type { ComponentProps } from 'react'
import { z } from 'zod'
import { WordDetailCard } from '@/components/history/WordDetailCard'
import { registerUnit } from '@/verify/core/registry'
import { FormType, LanguageType, type Entry, type FirestoreTimestamp } from '@/types'

type WordDetailCardProps = ComponentProps<typeof WordDetailCard>

const AUDIO_URL = 'https://storage.googleapis.com/ankiflow/audio/taberu.mp3'

function ts(iso: string): FirestoreTimestamp {
  const date = new Date(iso)
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => date,
  }
}

function makeEntry(overrides: Partial<Entry>): Entry {
  return {
    id: 'e0',
    user_id: 'local-user',
    category_id: null,
    form_type: FormType.LANGUAGE,
    anki_deck: 'Japanese Vocab',
    card_type_ids: [],
    tags: [],
    created_at: ts('2026-06-01T10:00:00Z'),
    updated_at: ts('2026-06-01T10:00:00Z'),
    status: 'draft',
    ...overrides,
  }
}

const FULL_ENTRY = makeEntry({
  id: 'e1',
  word: '食べる',
  hiragana: 'たべる',
  meaning_vi: 'ăn',
  word_type: 'verb',
  level: 'JLPT N5',
  language: LanguageType.JAPANESE,
  example_sentence: '毎朝パンを食べる。',
  example_translation: 'Mỗi sáng tôi ăn bánh mì.',
  collocations: ['ご飯を食べる', '朝食を食べる'],
  audio_url: AUDIO_URL,
  status: 'synced',
})

// entry tối thiểu — toàn bộ optional language fields vắng mặt
const MINIMAL_ENTRY = makeEntry({ id: 'e2' })

function audioInstances(): Array<{ src: string }> | null {
  const g = globalThis as unknown as { __verifyAudioInstances?: Array<{ src: string }> }
  return g.__verifyAudioInstances ?? null
}

registerUnit<WordDetailCardProps>({
  id: 'WordDetailCard',
  title: 'WordDetailCard',
  description: 'Card chi tiết entry trong history: word, reading, badges, example, collocations, audio.',
  kind: 'component',
  render: props => <WordDetailCard {...props} />,
  propsSchema: z.object({
    entry: z.looseObject({}),
  }),
  fixtures: [
    {
      id: 'full-entry',
      description: 'Entry tiếng Nhật đầy đủ — reading, level, example, collocations, audio.',
      props: { entry: FULL_ENTRY },
    },
    {
      id: 'act-play-audio',
      description: 'Act: click nút audio → Audio nhận đúng url (vitest stub).',
      props: { entry: FULL_ENTRY },
      act: async ctx => {
        await ctx.click('button[title="Play audio"]')
      },
    },
    {
      id: 'probe-minimal-entry',
      probe: true,
      description: 'Probe (gotcha optional fields): entry tối thiểu — "—", không reading/audio/example, không crash.',
      props: { entry: MINIMAL_ENTRY },
    },
  ],
  invariants: [
    {
      id: 'sync-badge-matches-status',
      description: 'Badge Synced/Pending sync khớp entry.status, contract synced đúng',
      check: ({ root, props, contract }) => {
        const synced = props.entry.status === 'synced'
        if (contract.synced !== String(synced)) return `contract.synced="${contract.synced}"`
        const expected = synced ? 'Synced' : 'Pending sync'
        return (root.textContent ?? '').includes(expected) || `không thấy badge "${expected}"`
      },
    },
    {
      id: 'full-entry-sections',
      description: 'Entry đầy đủ: word, reading, level, example, đủ collocations chip',
      onlyFixtures: ['full-entry', 'act-play-audio'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        if (!text.includes('食べる')) return 'không thấy word'
        if (!text.includes('たべる')) return 'không thấy reading'
        if (!text.includes('JLPT N5')) return 'không thấy level'
        if (!text.includes('毎朝パンを食べる。')) return 'không thấy example'
        const chips = root.querySelectorAll('[data-verify-unit="Badge"]').length
        // 2 collocations + badge status + badge level = 4
        return chips === 4 || `badges=${chips}, expected=4`
      },
    },
    {
      id: 'audio-button-iff-url',
      description: 'Nút audio hiện khi và chỉ khi entry.audio_url có giá trị',
      check: ({ root, props }) => {
        const hasButton = !!root.querySelector('button[title="Play audio"]')
        const expected = Boolean(props.entry.audio_url)
        return hasButton === expected || `audioBtn=${hasButton}, expected=${expected}`
      },
    },
    {
      id: 'play-audio-uses-url',
      description: 'Click audio: Audio stub nhận đúng audio_url (vitest)',
      onlyFixtures: ['act-play-audio'],
      check: () => {
        const instances = audioInstances()
        if (instances === null) return true // browser: không có stub
        const last = instances[instances.length - 1]
        return last?.src === AUDIO_URL || `Audio src="${last?.src}"`
      },
    },
    {
      id: 'minimal-entry-safe',
      description: 'Entry tối thiểu: "—" hiển thị, không reading, không example, không undefined',
      onlyFixtures: ['probe-minimal-entry'],
      check: ({ root }) => {
        const text = root.textContent ?? ''
        if (!text.includes('—')) return 'không thấy placeholder "—"'
        if (text.includes('undefined')) return 'leak chữ "undefined" ra UI'
        if (text.includes('Example')) return 'section Example render dù không có dữ liệu'
        return !text.includes('Collocations') || 'section Collocations render dù không có dữ liệu'
      },
    },
  ],
})
