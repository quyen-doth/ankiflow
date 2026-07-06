import { describe, expect, it } from 'vitest'
import { regenerateEntryNotes } from '@/lib/anki/regenerateEntryNotes'
import type { CardTypeItem } from '@/lib/buildNotes'
import type { AnkiNoteInfo } from '@/lib/flashcard-service/types'
import type { Entry } from '@/types'

const ENTRY: Partial<Entry> & { anki_note_ids: number[]; card_type_ids: string[] } = {
  word: 'hello',
  meaning_vi: 'xin chào',
  ipa: 'həˈloʊ',
  anki_deck: 'Test',
  anki_note_ids: [101, 102],
  card_type_ids: ['ct_wm', 'ct_mw'],
}

const cardTypeMap = new Map<string, CardTypeItem>([
  ['ct_wm', { id: 'ct_wm', name: 'Word → Meaning', code: 'word_to_meaning' }],
  ['ct_mw', { id: 'ct_mw', name: 'Meaning → Word', code: 'meaning_to_word' }],
])

function infoMap(entries: Record<number, string>): Map<number, AnkiNoteInfo> {
  return new Map(Object.entries(entries).map(([id, back]) => [
    Number(id),
    { noteId: Number(id), fields: { Front: { value: '', order: 0 }, Back: { value: back, order: 1 } } },
  ]))
}

describe('regenerateEntryNotes', () => {
  it('map noteId↔cardType theo index, sinh Front/Back cho từng note', () => {
    const { updates, skipped } = regenerateEntryNotes(ENTRY, cardTypeMap, infoMap({}))
    expect(skipped).toBe(0)
    expect(updates).toHaveLength(2)
    expect(updates[0].noteId).toBe(101)
    expect(updates[0].fields.Front).toContain('class="word"') // word_to_meaning front = word
    expect(updates[1].noteId).toBe(102)
    expect(updates[1].fields.Front).toContain('class="meaning"') // meaning_to_word front = meaning
  })

  it('giữ media cũ: trích [sound:] từ note hiện tại và nhúng lại', () => {
    const { updates } = regenerateEntryNotes(ENTRY, cardTypeMap, infoMap({ 101: 'x [sound:old.mp3]' }))
    expect(updates[0].fields.Back).toContain('[sound:old.mp3]')
  })

  it('length lệch (note ≠ card type) → skipped, không update', () => {
    const bad = { ...ENTRY, anki_note_ids: [101], card_type_ids: ['ct_wm', 'ct_mw'] }
    const { updates, skipped } = regenerateEntryNotes(bad, cardTypeMap, infoMap({}))
    expect(updates).toHaveLength(0)
    expect(skipped).toBe(1)
  })

  it('card type không tồn tại trong map → skip note đó', () => {
    const e = { ...ENTRY, card_type_ids: ['ct_wm', 'ct_unknown'] }
    const { updates, skipped } = regenerateEntryNotes(e, cardTypeMap, infoMap({}))
    expect(updates).toHaveLength(1)
    expect(updates[0].noteId).toBe(101)
    expect(skipped).toBe(1)
  })

  it('onlyCardTypeId → chỉ sinh note của card type đó', () => {
    const { updates } = regenerateEntryNotes(ENTRY, cardTypeMap, infoMap({}), 'ct_mw')
    expect(updates).toHaveLength(1)
    expect(updates[0].noteId).toBe(102)
  })

  it('không có note ids → rỗng', () => {
    const e = { ...ENTRY, anki_note_ids: [], card_type_ids: [] }
    const { updates, skipped } = regenerateEntryNotes(e, cardTypeMap, infoMap({}))
    expect(updates).toHaveLength(0)
    expect(skipped).toBe(0)
  })
})
