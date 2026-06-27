import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Entry } from '@/types'

interface DueEntriesOptions {
  deckFilter?: string[]
  languageFilter?: string[]
  limit?: number
}

export async function getDueEntries(now: Date = new Date(), options: DueEntriesOptions = {}): Promise<Entry[]> {
  const { deckFilter, languageFilter, limit: maxResults = 30 } = options
  const nowISO = now.toISOString()

  const constraints = [
    where('status', '==', 'synced'),
    where('review_state.due_date', '<=', nowISO),
    orderBy('review_state.due_date', 'asc'),
    firestoreLimit(maxResults),
  ]

  const q = query(collection(db, 'entries'), ...constraints)
  const snapshot = await getDocs(q)
  let entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Entry)

  if (deckFilter && deckFilter.length > 0) {
    entries = entries.filter(e => deckFilter.includes(e.anki_deck))
  }

  if (languageFilter && languageFilter.length > 0) {
    entries = entries.filter(e => e.language && languageFilter.includes(e.language))
  }

  return entries
}

export function pickReviewVocabulary(entries: Entry[], count: number = 3): Entry[] {
  if (entries.length <= count) return entries

  const prioritized = [...entries].sort((a, b) => {
    const aState = a.review_state
    const bState = b.review_state
    if (!aState || !bState) return 0

    const aRelearn = aState.queue === 'relearning' ? 0 : 1
    const bRelearn = bState.queue === 'relearning' ? 0 : 1
    if (aRelearn !== bRelearn) return aRelearn - bRelearn

    if (bState.lapses !== aState.lapses) return bState.lapses - aState.lapses

    return aState.ease_factor - bState.ease_factor
  })

  const top = prioritized.slice(0, Math.min(10, prioritized.length))

  const shuffled = [...top]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled.slice(0, count)
}
