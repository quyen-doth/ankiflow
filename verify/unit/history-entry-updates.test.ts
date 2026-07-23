import { describe, expect, it } from 'vitest'
import { buildHistoryEntryUpdates } from '@/lib/historyEntryUpdates'

describe('buildHistoryEntryUpdates', () => {
  it('History save payload に custom string/string[] を保持する', () => {
    const updates = buildHistoryEntryUpdates(
      {
        word: '吃饭',
        meaning_vi: 'ご飯を食べる',
        audio_url: 'old.mp3',
        audio_example_url: 'old-example.mp3',
        anki_deck: 'Chinese',
        category_id: null,
      },
      [
        { key: 'phon_the', label: 'Traditional form', value: '喫飯' },
        { key: 'related_words', label: 'Related words', value: ['用餐', '吃東西'] },
      ],
      ['card-type-1'],
      {
        audioUrl: 'new.mp3',
        audioExampleUrl: 'new-example.mp3',
      },
    )

    expect(updates).toMatchObject({
      word: '吃饭',
      meaning_vi: 'ご飯を食べる',
      audio_url: 'new.mp3',
      audio_example_url: 'new-example.mp3',
      card_type_ids: ['card-type-1'],
      phon_the: '喫飯',
      related_words: ['用餐', '吃東西'],
    })
    expect(updates).not.toHaveProperty('term')
  })
})
