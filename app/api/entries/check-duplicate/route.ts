import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/firebase-admin'
import { withAuth } from '@/lib/auth-guard'
import { normalizeTerm } from '@/lib/entries/duplicate'

interface DuplicateEntry {
  id: string
  word: string
  anki_deck: string
  status: string
  created_at: string | null
}

export const POST = withAuth(async (request, _ctx, uid) => {
  try {
    const body = await request.json()
    const { word, words } = body as { word?: string; words?: string[] }

    // チェック対象の単語一覧: `words` (batch) を優先し、`word` (single) に fallback。
    const targets: string[] = Array.isArray(words) ? words : word ? [word] : []
    if (targets.length === 0) {
      return NextResponse.json({ error: 'Missing word' }, { status: 400 })
    }

    const db = getAdminDb()

    // グローバルチェック: user の全 entries を走査し、deck/言語では絞らない。
    const snapshot = await db.collection('entries')
      .where('user_id', '==', uid)
      .get()

    const allEntries = snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        normalized: normalizeTerm(data.word || data.term || data.title || ''),
        entry: {
          id: doc.id,
          word: data.word || data.term || data.title,
          anki_deck: data.anki_deck,
          status: data.status,
          created_at: data.created_at?.toDate?.()?.toISOString() || null,
        } as DuplicateEntry,
      }
    })

    const matchFor = (w: string): DuplicateEntry[] => {
      const wl = normalizeTerm(w)
      return allEntries.filter(e => e.normalized === wl).map(e => e.entry)
    }

    // Batch: 単語ごとの結果配列を返す。
    if (Array.isArray(words)) {
      const results = words.map(w => ({ word: w, duplicates: matchFor(w) }))
      return NextResponse.json({ results })
    }

    // Single: 後方互換。
    const duplicates = matchFor(targets[0])
    return NextResponse.json({
      isDuplicate: duplicates.length > 0,
      duplicates,
    })
  } catch (error) {
    console.error('Check duplicate error:', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
})
