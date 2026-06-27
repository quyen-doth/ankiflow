import type { Entry } from '@/types'
import { calculateNextIntervals } from '@/lib/srs/sm2'
import type { LineFlexMessage } from './client'

const LANG_FLAGS: Record<string, string> = {
  ja: '🇯🇵',
  zh: '🇨🇳',
  en: '🇬🇧',
}

const RATING_COLORS: Record<string, string> = {
  again: '#dc2626',
  hard: '#d97706',
  good: '#16a34a',
  easy: '#2563eb',
}

function getWordLabel(entry: Entry): string {
  return entry.word ?? entry.term ?? entry.title ?? '—'
}

function getReading(entry: Entry): string | null {
  return entry.hiragana ?? entry.pinyin ?? entry.ipa ?? null
}

function getMeaning(entry: Entry): string {
  return entry.meaning_vi ?? entry.definition ?? entry.content ?? '—'
}

function buildVocabBubble(entry: Entry): Record<string, unknown> {
  const word = getWordLabel(entry)
  const reading = getReading(entry)
  const meaning = getMeaning(entry)
  const flag = entry.language ? LANG_FLAGS[entry.language] ?? '' : ''
  const intervals = entry.review_state
    ? calculateNextIntervals(entry.review_state)
    : { again: '1m', hard: '6m', good: '1d', easy: '4d' }

  const bodyContents: Record<string, unknown>[] = []

  if (reading) {
    bodyContents.push({
      type: 'text',
      text: reading,
      size: 'sm',
      color: '#94a3b8',
      margin: 'xs',
    })
  }

  bodyContents.push({
    type: 'text',
    text: meaning,
    size: 'sm',
    color: '#334155',
    margin: 'md',
    wrap: true,
  })

  if (entry.word_type) {
    bodyContents.push({
      type: 'text',
      text: entry.word_type,
      size: 'xxs',
      color: '#94a3b8',
      margin: 'sm',
    })
  }

  if (entry.example_sentence) {
    bodyContents.push({
      type: 'separator',
      margin: 'lg',
    })
    bodyContents.push({
      type: 'text',
      text: entry.example_sentence,
      size: 'sm',
      color: '#1e293b',
      margin: 'md',
      wrap: true,
    })
    if (entry.example_translation) {
      bodyContents.push({
        type: 'text',
        text: `→ ${entry.example_translation}`,
        size: 'xs',
        color: '#64748b',
        margin: 'xs',
        wrap: true,
      })
    }
  }

  const ratingButtons = (['again', 'hard', 'good', 'easy'] as const).map(rating => ({
    type: 'button',
    action: {
      type: 'postback',
      label: `${rating.charAt(0).toUpperCase() + rating.slice(1)} ${intervals[rating]}`,
      data: `ankiflow:action=srs_rate&entry_id=${entry.id}&rating=${rating}`,
      displayText: `${rating.charAt(0).toUpperCase() + rating.slice(1)}`,
    },
    style: 'link',
    height: 'sm',
    color: RATING_COLORS[rating],
  }))

  return {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'horizontal',
      contents: [
        ...(flag ? [{
          type: 'text',
          text: flag,
          size: 'lg',
          flex: 0,
        }] : []),
        {
          type: 'text',
          text: word,
          weight: 'bold',
          size: 'xl',
          color: '#1e293b',
          flex: 1,
        },
      ],
      paddingBottom: 'sm',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: bodyContents,
      paddingTop: 'none',
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      contents: ratingButtons,
      spacing: 'none',
    },
  }
}

export function buildReviewMessage(entries: Entry[]): LineFlexMessage {
  const words = entries.map(getWordLabel)
  const altText = `🧠 ${words.join(' · ')}`

  if (entries.length === 1) {
    return {
      type: 'flex',
      altText,
      contents: buildVocabBubble(entries[0]),
    }
  }

  return {
    type: 'flex',
    altText,
    contents: {
      type: 'carousel',
      contents: entries.map(buildVocabBubble),
    },
  }
}
