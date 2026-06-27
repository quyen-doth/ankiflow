/**
 * scripts/send-notifications.ts
 * Standalone script to send LINE vocabulary review notifications.
 *
 * Run: npx tsx scripts/send-notifications.ts
 * Environment: GitHub Actions cron or manual local execution.
 * Requires: FIREBASE_ADMIN_* + LINE_CHANNEL_ACCESS_TOKEN + LINE_USER_ID
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

let serviceAccount: { projectId?: string; clientEmail?: string; privateKey?: string }

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
} else {
  serviceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }
}

const app = initializeApp({ credential: cert(serviceAccount as Parameters<typeof cert>[0]) })
const db = getFirestore(app)

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN
const LINE_USER_ID = process.env.LINE_USER_ID

if (!LINE_TOKEN || !LINE_USER_ID) {
  console.error('Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_USER_ID')
  process.exit(1)
}

interface EntryDoc {
  id: string
  word?: string
  term?: string
  title?: string
  meaning_vi?: string
  definition?: string
  content?: string
  language?: string
  hiragana?: string
  pinyin?: string
  ipa?: string
  word_type?: string
  example_sentence?: string
  example_translation?: string
  anki_deck: string
  review_state?: {
    ease_factor: number
    interval_days: number
    due_date: string
    lapses: number
    queue: string
  }
}

const LANG_FLAGS: Record<string, string> = { ja: '🇯🇵', zh: '🇨🇳', en: '🇬🇧' }

const RATING_COLORS: Record<string, string> = {
  again: '#dc2626',
  hard: '#d97706',
  good: '#16a34a',
  easy: '#2563eb',
}

function getWord(e: EntryDoc): string {
  return e.word ?? e.term ?? e.title ?? '—'
}

function buildFlexBubble(entry: EntryDoc): Record<string, unknown> {
  const word = getWord(entry)
  const reading = entry.hiragana ?? entry.pinyin ?? entry.ipa ?? null
  const meaning = entry.meaning_vi ?? entry.definition ?? entry.content ?? '—'
  const flag = entry.language ? LANG_FLAGS[entry.language] ?? '' : ''

  const intervals = computeIntervals(entry)

  const bodyContents: Record<string, unknown>[] = []

  if (reading) {
    bodyContents.push({ type: 'text', text: reading, size: 'sm', color: '#94a3b8', margin: 'xs' })
  }
  bodyContents.push({ type: 'text', text: meaning, size: 'sm', color: '#334155', margin: 'md', wrap: true })

  if (entry.word_type) {
    bodyContents.push({ type: 'text', text: entry.word_type, size: 'xxs', color: '#94a3b8', margin: 'sm' })
  }

  if (entry.example_sentence) {
    bodyContents.push({ type: 'separator', margin: 'lg' })
    bodyContents.push({ type: 'text', text: entry.example_sentence, size: 'sm', color: '#1e293b', margin: 'md', wrap: true })
    if (entry.example_translation) {
      bodyContents.push({ type: 'text', text: `→ ${entry.example_translation}`, size: 'xs', color: '#64748b', margin: 'xs', wrap: true, style: 'italic' })
    }
  }

  const buttons = (['again', 'hard', 'good', 'easy'] as const).map(rating => ({
    type: 'button',
    action: {
      type: 'postback',
      label: `${rating.charAt(0).toUpperCase() + rating.slice(1)} ${intervals[rating]}`,
      data: `ankiflow:action=srs_rate&entry_id=${entry.id}&rating=${rating}`,
      displayText: rating.charAt(0).toUpperCase() + rating.slice(1),
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
        ...(flag ? [{ type: 'text', text: flag, size: 'lg', flex: 0 }] : []),
        { type: 'text', text: word, weight: 'bold', size: 'xl', color: '#1e293b', flex: 1 },
      ],
      paddingBottom: 'sm',
    },
    body: { type: 'box', layout: 'vertical', contents: bodyContents, paddingTop: 'none' },
    footer: { type: 'box', layout: 'horizontal', contents: buttons, spacing: 'none' },
  }
}

function computeIntervals(entry: EntryDoc): Record<string, string> {
  const rs = entry.review_state
  if (!rs || rs.queue === 'new' || rs.queue === 'learning') {
    return { again: '1m', hard: '1m', good: '10m', easy: '4d' }
  }

  const ease = rs.ease_factor || 2.5
  const interval = rs.interval_days || 1

  const hard = Math.max(Math.round(interval * 1.2), interval + 1)
  const good = Math.max(Math.round(interval * ease), interval + 1)
  const easyEase = Math.max(1.3, ease + 0.15)
  const easyInterval = Math.max(Math.round(interval * easyEase * 1.3), interval + 1)

  return {
    again: '10m',
    hard: formatDays(hard),
    good: formatDays(good),
    easy: formatDays(easyInterval),
  }
}

function formatDays(days: number): string {
  if (days >= 365) return `${Math.round(days / 365 * 10) / 10}y`
  if (days >= 30) return `${Math.round(days / 30 * 10) / 10}mo`
  return `${days}d`
}

async function main() {
  console.log('📚 AnkiFlow Notification Sender')
  console.log(`📅 ${new Date().toISOString()}`)

  // Load triggers
  const triggersSnap = await db.collection('notification_triggers')
    .where('is_active', '==', true)
    .where('type', '==', 'vocab_review')
    .get()

  let deckFilter: string[] = []
  let languageFilter: string[] = []
  let wordsPerNotification = 3

  if (!triggersSnap.empty) {
    const trigger = triggersSnap.docs[0].data()
    deckFilter = trigger.deck_filter ?? []
    languageFilter = trigger.language_filter ?? []
    wordsPerNotification = trigger.words_per_notification ?? 3
    console.log(`🔔 Trigger: "${trigger.name}" (${wordsPerNotification} words)`)
  } else {
    console.log('ℹ️  No active triggers found, using defaults (3 words, all decks)')
  }

  // Load entries
  const entriesSnap = await db.collection('entries')
    .where('status', '==', 'synced')
    .get()

  if (entriesSnap.empty) {
    console.log('⚠️  No synced entries found. Exiting.')
    return
  }

  let entries: EntryDoc[] = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as EntryDoc)

  if (deckFilter.length > 0) {
    entries = entries.filter(e => deckFilter.includes(e.anki_deck))
  }
  if (languageFilter.length > 0) {
    entries = entries.filter(e => e.language && languageFilter.includes(e.language))
  }

  const now = new Date()
  const dueEntries = entries.filter(e => {
    if (!e.review_state) return true
    return new Date(e.review_state.due_date) <= now
  })

  if (dueEntries.length === 0) {
    console.log('✅ No entries due for review. Exiting.')
    return
  }

  console.log(`📋 ${dueEntries.length} entries due for review`)

  // Prioritize: relearning first, then high lapses, then low ease
  const sorted = [...dueEntries].sort((a, b) => {
    const aRS = a.review_state
    const bRS = b.review_state
    if (!aRS && !bRS) return 0
    if (!aRS) return -1
    if (!bRS) return 1
    const aR = aRS.queue === 'relearning' ? 0 : 1
    const bR = bRS.queue === 'relearning' ? 0 : 1
    if (aR !== bR) return aR - bR
    if (bRS.lapses !== aRS.lapses) return bRS.lapses - aRS.lapses
    return aRS.ease_factor - bRS.ease_factor
  })

  // Pick random from top 10
  const top = sorted.slice(0, Math.min(10, sorted.length))
  for (let i = top.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [top[i], top[j]] = [top[j], top[i]]
  }
  const selected = top.slice(0, wordsPerNotification)

  const words = selected.map(getWord)
  const altText = `🧠 ${words.join(' · ')}`

  console.log(`📤 Sending: ${words.join(', ')}`)

  // Build carousel
  const flexMessage = {
    type: 'flex' as const,
    altText,
    contents: selected.length === 1
      ? buildFlexBubble(selected[0])
      : { type: 'carousel', contents: selected.map(buildFlexBubble) },
  }

  // Send via LINE
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({
      to: LINE_USER_ID,
      messages: [flexMessage],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error('❌ LINE push failed:', err)
    process.exit(1)
  }

  console.log(`✅ Sent ${selected.length} vocabulary cards to LINE`)
}

main().catch(err => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
