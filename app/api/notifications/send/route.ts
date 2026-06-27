import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { pushMessage } from '@/lib/line/client'
import { buildReviewMessage } from '@/lib/line/flex-message'
import { createDefaultReviewState } from '@/lib/srs/sm2'
import type { Entry, ReviewState } from '@/types'

export async function POST(request: Request) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  const userId = process.env.LINE_USER_ID
  if (!token || !userId) {
    return NextResponse.json({ error: 'LINE credentials not configured' }, { status: 500 })
  }

  const body = await request.json().catch(() => ({}))
  const deckFilter = (body.deck_filter as string[] | undefined) ?? []
  const languageFilter = (body.language_filter as string[] | undefined) ?? []
  const count = (body.count as number | undefined) ?? 3

  const db = getAdminDb()
  const now = new Date()
  const nowISO = now.toISOString()

  const snapshot = await db.collection('entries')
    .where('status', '==', 'synced')
    .get()

  if (snapshot.empty) {
    return NextResponse.json({ success: true, sent: 0, message: 'No synced entries' })
  }

  let entries: Entry[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Entry)

  if (deckFilter.length > 0) {
    entries = entries.filter(e => deckFilter.includes(e.anki_deck))
  }
  if (languageFilter.length > 0) {
    entries = entries.filter(e => e.language && languageFilter.includes(e.language))
  }

  const dueEntries = entries.filter(e => {
    const rs = e.review_state
    if (!rs) return true
    return new Date(rs.due_date) <= now
  })

  if (dueEntries.length === 0) {
    return NextResponse.json({ success: true, sent: 0, message: 'No entries due for review' })
  }

  const prioritized = [...dueEntries].sort((a, b) => {
    const aRS = a.review_state
    const bRS = b.review_state
    if (!aRS && !bRS) return 0
    if (!aRS) return -1
    if (!bRS) return 1
    const aRelearn = aRS.queue === 'relearning' ? 0 : 1
    const bRelearn = bRS.queue === 'relearning' ? 0 : 1
    if (aRelearn !== bRelearn) return aRelearn - bRelearn
    if (bRS.lapses !== aRS.lapses) return bRS.lapses - aRS.lapses
    return aRS.ease_factor - bRS.ease_factor
  })

  const top = prioritized.slice(0, Math.min(10, prioritized.length))
  const shuffled = [...top]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const selected = shuffled.slice(0, count)

  for (const entry of selected) {
    if (!entry.review_state) {
      entry.review_state = createDefaultReviewState(nowISO)
    }
  }

  const message = buildReviewMessage(selected)
  const result = await pushMessage(token, userId, [message])

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'LINE push failed' }, { status: 502 })
  }

  return NextResponse.json({
    success: true,
    sent: selected.length,
    words: selected.map(e => e.word ?? e.term ?? e.title),
  })
}
