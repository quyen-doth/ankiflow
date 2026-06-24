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
 * Đồng bộ deck với Anki theo `op`:
 *  - 'ensure'    : tạo deck nếu chưa có (idempotent)
 *  - 'rename'    : tạo deck mới + chuyển toàn bộ thẻ từ deck cũ + xóa deck cũ
 *  - 'suspend'   : suspend mọi thẻ trong deck (deck inactive)
 *  - 'unsuspend' : unsuspend mọi thẻ trong deck (deck active lại)
 * Tương thích ngược: body chỉ có { deckName } → mặc định 'ensure'.
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
        // Xóa hoàn toàn: xóa deck KÈM toàn bộ thẻ bên trong.
        await flashcardService.deleteDecks([deckName], true)
        break
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
        // Đẩy toàn bộ deck của app lên Anki: ensure tồn tại + suspend/unsuspend theo trạng thái.
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
