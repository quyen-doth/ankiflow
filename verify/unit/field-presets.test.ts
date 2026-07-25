import { describe, expect, it } from 'vitest'
import {
  FIELD_PRESETS,
  resolveFieldPresets,
  type FieldPreset,
} from '@/lib/ai-agent/fieldPresets'
import { aiOutputFieldSchema } from '@/lib/ai-agent/outputProfiles'
import type { AiOutputField } from '@/types'

describe('fieldPresets', () => {
  it('profile に一致する preset を catalog 順で返す', () => {
    expect(resolveFieldPresets('zh', []).map(preset => preset.key)).toEqual([
      'phon_the',
      'mau_cau',
    ])
    expect(resolveFieldPresets('ja', []).map(preset => preset.key)).toEqual([
      'kanji_breakdown',
    ])
    expect(resolveFieldPresets('default', []).map(preset => preset.key)).toEqual([
      'mnemonic',
      'synonyms',
      'antonyms',
      'common_mistakes',
    ])
  })

  it('既存 key と空白を正規化して重複 preset を除外する', () => {
    expect(resolveFieldPresets(' ZH ', [' phon_the ']).map(preset => preset.key)).toEqual([
      'mau_cau',
    ])
  })

  it('対象外 profile には suggestion を返さない', () => {
    expect(resolveFieldPresets('en', [])).toEqual([])
    expect(resolveFieldPresets('fr', [])).toEqual([])
  })

  it('既存 built-in の han_viet を preset として重複定義しない', () => {
    const presetKeys: readonly string[] = FIELD_PRESETS.map(preset => preset.key)
    expect(presetKeys).not.toContain('han_viet')
  })

  it('中国語 preset は保存可能な field metadata を保持する', () => {
    const traditional = FIELD_PRESETS.find(preset => preset.key === 'phon_the')
    const patterns = FIELD_PRESETS.find(preset => preset.key === 'mau_cau')

    expect(traditional).toMatchObject({
      type: 'string',
      profiles: ['zh'],
    })
    expect(traditional?.instruction).toContain(
      'Return an empty string if identical to the simplified form.',
    )
    expect(patterns).toMatchObject({
      type: 'string_array',
      max_items: 5,
      profiles: ['zh'],
    })
  })

  it('すべての preset が保存時と同じ AI output field schema を満たす', () => {
    const presets: readonly FieldPreset[] = FIELD_PRESETS
    for (const preset of presets) {
      const field: AiOutputField = {
        key: preset.key,
        type: preset.type,
        instruction: preset.instruction,
        ...(preset.include_when !== undefined ? { include_when: preset.include_when } : {}),
        ...(preset.max_items !== undefined ? { max_items: preset.max_items } : {}),
      }
      expect(aiOutputFieldSchema.safeParse(field).success, preset.key).toBe(true)
    }
  })
})
