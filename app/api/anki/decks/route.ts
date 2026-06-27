import { NextResponse } from 'next/server';
import { flashcardService } from '@/lib/flashcard-service';

export async function GET() {
  try {
    const decks = await flashcardService.getDecks();
    return NextResponse.json({ decks });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * Sync deck with Anki by `op`:
 *  - 'ensure'    : create deck if not exists (idempotent)
 *  - 'rename'    : create new deck + move all cards from old deck + delete old deck
 *  - 'delete'    : delete deck with all cards + clean up empty parent decks
 *  - 'suspend'   : suspend all cards in deck (deck inactive)
 *  - 'unsuspend' : unsuspend all cards in deck (deck active again)
 *  - 'sync-all'  : ensure all app decks exist + suspend/unsuspend by status
 * Backwards-compatible: body with only { deckName } defaults to 'ensure'.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const op: string = body.op ?? 'ensure'
    const deckQuery = (name: string) => `deck:"${name}"`

    switch (op) {
      case 'rename': {
        const { oldName, newName } = body
        if (!oldName || !newName) {
          return NextResponse.json({ error: 'Missing oldName/newName' }, { status: 400 })
        }
        if (oldName === newName) {
          await flashcardService.createDeck(newName)
          break
        }
        await flashcardService.createDeck(newName)
        const cards = await flashcardService.findCards(deckQuery(oldName))
        await flashcardService.changeDeck(cards, newName)
        await flashcardService.deleteDecks([oldName])
        break
      }
      case 'delete': {
        const { deckName } = body
        if (!deckName) return NextResponse.json({ error: 'Missing deckName' }, { status: 400 })
        await flashcardService.deleteDecks([deckName], true)

        // Clean up empty parent decks walking up the `::` hierarchy
        const cleanedParents: string[] = []
        try {
          const remaining = await flashcardService.getDecks()
          const remainingSet = new Set(remaining)
          const parts = deckName.split('::')
          for (let depth = parts.length - 1; depth >= 1; depth--) {
            const parent = parts.slice(0, depth).join('::')
            if (!remainingSet.has(parent)) break
            const hasChildren = remaining.some(d => d.startsWith(parent + '::'))
            if (hasChildren) break
            await flashcardService.deleteDecks([parent], true)
            remainingSet.delete(parent)
            cleanedParents.push(parent)
          }
        } catch (e) {
          console.warn('Parent cleanup failed (non-fatal):', e)
        }

        return NextResponse.json({ success: true, cleanedParents })
      }
      case 'suspend':
      case 'unsuspend': {
        const { deckName } = body
        if (!deckName) return NextResponse.json({ error: 'Missing deckName' }, { status: 400 })
        const cards = await flashcardService.findCards(deckQuery(deckName))
        if (op === 'suspend') await flashcardService.suspend(cards)
        else await flashcardService.unsuspend(cards)
        break
      }
      case 'sync-all': {
        // Push all app decks to Anki: ensure they exist + suspend/unsuspend by status.
        const decks = body.decks as { name: string; is_active: boolean }[] | undefined
        if (!Array.isArray(decks)) {
          return NextResponse.json({ error: 'Missing decks array' }, { status: 400 })
        }
        let synced = 0
        const failed: { name: string; error: string }[] = []
        for (const d of decks) {
          if (!d?.name) continue
          try {
            await flashcardService.createDeck(d.name)
            const cards = await flashcardService.findCards(deckQuery(d.name))
            if (d.is_active) await flashcardService.unsuspend(cards)
            else await flashcardService.suspend(cards)
            synced++
          } catch (e) {
            failed.push({ name: d.name, error: (e as Error).message })
          }
        }
        return NextResponse.json({ success: failed.length === 0, synced, total: decks.length, failed })
      }
      case 'ensure':
      default: {
        const { deckName } = body
        if (!deckName) return NextResponse.json({ error: 'Missing deckName' }, { status: 400 })
        await flashcardService.createDeck(deckName)
        break
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
