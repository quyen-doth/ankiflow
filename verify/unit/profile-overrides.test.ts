import { describe, expect, it } from 'vitest'
import { resolveDefaultFieldOverrides } from '@/lib/ai-agent/profileOverrides'
import type { AiOutputProfile } from '@/types'

function profilesWith(
  languageProfiles: AiOutputProfile[],
  defaultMaxItems = 10,
): AiOutputProfile[] {
  return [
    {
      profile: 'default',
      fields: [{
        key: 'related_words',
        type: 'string_array',
        instruction: 'Default instruction',
        max_items: defaultMaxItems,
      }],
    },
    ...languageProfiles,
  ]
}

describe('resolveDefaultFieldOverrides', () => {
  it('Default に存在しない own field は override として返さない', () => {
    const overrides = resolveDefaultFieldOverrides(profilesWith([{
      profile: 'zh',
      inherit: true,
      exclude: [],
      fields: [{
        key: 'phon_the',
        type: 'string',
        instruction: 'Traditional form',
      }],
    }]))

    expect(overrides.size).toBe(0)
  })

  it('instruction だけが異なる own field も差分文言なしの override として返す', () => {
    const overrides = resolveDefaultFieldOverrides(profilesWith([{
      profile: 'zh',
      inherit: true,
      exclude: [],
      fields: [{
        key: 'related_words',
        type: 'string_array',
        instruction: 'Chinese instruction',
        max_items: 10,
      }],
    }]))

    expect(overrides.get('related_words')).toEqual([{
      profile: 'zh',
      label: 'Chinese',
      diffs: [],
    }])
  })

  it('effective max_items が Default と異なる場合は max 差分を返す', () => {
    const overrides = resolveDefaultFieldOverrides(profilesWith([{
      profile: 'zh',
      inherit: true,
      exclude: [],
      fields: [{
        key: 'related_words',
        type: 'string_array',
        instruction: 'Chinese instruction',
        max_items: 5,
      }],
    }]))

    expect(overrides.get('related_words')?.[0]?.diffs).toEqual(['max 5'])
  })

  it('複数 profile の override を profile 順で返す', () => {
    const overrides = resolveDefaultFieldOverrides(profilesWith([
      {
        profile: 'zh',
        inherit: true,
        exclude: [],
        fields: [{
          key: 'related_words',
          type: 'string_array',
          instruction: 'Chinese instruction',
          max_items: 5,
        }],
      },
      {
        profile: 'ja',
        inherit: true,
        exclude: [],
        fields: [{
          key: 'related_words',
          type: 'string_array',
          instruction: 'Japanese instruction',
          max_items: 8,
        }],
      },
    ]))

    expect(overrides.get('related_words')).toEqual([
      { profile: 'zh', label: 'Chinese', diffs: ['max 5'] },
      { profile: 'ja', label: 'Japanese', diffs: ['max 8'] },
    ])
  })
})
