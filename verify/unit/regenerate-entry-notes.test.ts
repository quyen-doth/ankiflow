import { describe, expect, it } from 'vitest'
import { regenerateEntryNotes } from '@/lib/anki/regenerateEntryNotes'
import type { CardTypeItem } from '@/lib/buildNotes'
import type { AnkiNoteInfo } from '@/lib/flashcard-service/types'
import type { Entry } from '@/types'

const ENTRY: Partial<Entry> & { anki_note_ids: number[]; card_type_ids: string[] } = {
  word: 'hello',
  meaning_vi: 'こんにちは',
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
  it('noteId↔cardType を index でマップし、各 note の Front/Back を生成', () => {
    const { updates, skipped } = regenerateEntryNotes(ENTRY, cardTypeMap, infoMap({}))
    expect(skipped).toBe(0)
    expect(updates).toHaveLength(2)
    expect(updates[0].noteId).toBe(101)
    expect(updates[0].fields.Front).toContain('class="word"') // word_to_meaning front = word
    expect(updates[1].noteId).toBe(102)
    expect(updates[1].fields.Front).toContain('class="meaning"') // meaning_to_word front = meaning
  })

  it('既存メディアを保持: 現在の note から [sound:] を抽出して再埋め込み', () => {
    const { updates } = regenerateEntryNotes(ENTRY, cardTypeMap, infoMap({ 101: 'x [sound:old.mp3]' }))
    expect(updates[0].fields.Back).toContain('[sound:old.mp3]')
  })

  it('既存 note の通常 audio と例文 audio を順序に依存せず別 block へ再埋め込み', () => {
    const entry = {
      ...ENTRY,
      anki_note_ids: [201],
      card_type_ids: ['ct-two-audio'],
    }
    const types = new Map<string, CardTypeItem>([
      ['ct-two-audio', {
        id: 'ct-two-audio',
        name: 'Two audio',
        template: {
          front: ['audio'],
          back: ['word', 'audio_example'],
        },
      }],
    ])
    const infos = infoMap({
      201: '[sound:ankiflow_audio_ex_hello.mp3] [sound:ankiflow_hello.mp3]',
    })

    const { updates } = regenerateEntryNotes(entry, types, infos)

    expect(updates[0].fields.Front).toContain('[sound:ankiflow_hello.mp3]')
    expect(updates[0].fields.Front).not.toContain('ankiflow_audio_ex_hello.mp3')
    expect(updates[0].fields.Back).toContain('[sound:ankiflow_audio_ex_hello.mp3]')
    expect(updates[0].fields.Back).not.toContain('[sound:ankiflow_hello.mp3]')
  })

  it('length 不一致 (note ≠ card type) → skipped、update なし', () => {
    const bad = { ...ENTRY, anki_note_ids: [101], card_type_ids: ['ct_wm', 'ct_mw'] }
    const { updates, skipped } = regenerateEntryNotes(bad, cardTypeMap, infoMap({}))
    expect(updates).toHaveLength(0)
    expect(skipped).toBe(1)
  })

  it('card type が map に存在しない → その note をスキップ', () => {
    const e = { ...ENTRY, card_type_ids: ['ct_wm', 'ct_unknown'] }
    const { updates, skipped } = regenerateEntryNotes(e, cardTypeMap, infoMap({}))
    expect(updates).toHaveLength(1)
    expect(updates[0].noteId).toBe(101)
    expect(skipped).toBe(1)
  })

  it('onlyCardTypeId → その card type の note のみ生成', () => {
    const { updates } = regenerateEntryNotes(ENTRY, cardTypeMap, infoMap({}), 'ct_mw')
    expect(updates).toHaveLength(1)
    expect(updates[0].noteId).toBe(102)
  })

  it('note ids がない → 空', () => {
    const e = { ...ENTRY, anki_note_ids: [], card_type_ids: [] }
    const { updates, skipped } = regenerateEntryNotes(e, cardTypeMap, infoMap({}))
    expect(updates).toHaveLength(0)
    expect(skipped).toBe(0)
  })
})
