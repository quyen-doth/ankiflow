import type { SRSRating } from '@/types'

export { applyRating } from './fsrs'

interface PostbackData {
  action: string
  entry_id: string
  rating: SRSRating
}

const VALID_RATINGS: SRSRating[] = ['again', 'hard', 'good', 'easy']

export function parsePostbackData(data: string): PostbackData | null {
  const prefix = 'ankiflow:'
  if (!data.startsWith(prefix)) return null

  const params = new URLSearchParams(data.slice(prefix.length))
  const action = params.get('action')
  const entryId = params.get('entry_id')
  const rating = params.get('rating') as SRSRating | null

  if (action !== 'srs_rate' || !entryId || !rating) return null
  if (!VALID_RATINGS.includes(rating)) return null

  return { action, entry_id: entryId, rating }
}
