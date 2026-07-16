import { describe, expect, it } from 'vitest'
import {
  createAdminSettingsSnapshot,
  createPersonalSettingsSnapshot,
} from '@/lib/settings-form-state'
import type { Settings } from '@/types'

function personalSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    unsplash_enabled: true,
    tts_enabled: true,
    ai_model: 'claude-haiku-4-5',
    web_search_enabled: false,
    anki_connect_url: 'http://localhost:8765',
    allow_duplicate: false,
    auto_audio: true,
    auto_image: false,
    user_name: 'Test User',
    notifications_enabled: false,
    study_languages: [
      { code: 'en', display_name: 'English', enabled: true, sort_order: 0 },
      { code: 'ja', display_name: 'Japanese', enabled: true, sort_order: 1 },
    ],
    ai_output_language: 'vi',
    updated_at: null as unknown as Settings['updated_at'],
    ...overrides,
  }
}

const adminSettings = {
  featureFlags: {
    tts_available: true,
    unsplash_available: false,
  },
  aiConfig: {
    ai_model: 'claude-haiku-4-5',
    web_search_enabled: true,
  },
  lineConfig: {
    line_notifications_available: true,
    line_schedule_hours: [9, 21],
  },
  lineWordsInput: '5',
}

describe('settings form snapshots', () => {
  it('個人設定の同じ保存対象値は同じ snapshot になる', () => {
    const original = personalSettings()
    const cloned = personalSettings({
      study_languages: original.study_languages?.map(language => ({ ...language })),
    })

    expect(createPersonalSettingsSnapshot(cloned))
      .toBe(createPersonalSettingsSnapshot(original))
  })

  it('個人設定の変更と復元を検出する', () => {
    const original = personalSettings()
    const changed = personalSettings({ auto_audio: false })
    const restored = personalSettings({ auto_audio: true })

    expect(createPersonalSettingsSnapshot(changed))
      .not.toBe(createPersonalSettingsSnapshot(original))
    expect(createPersonalSettingsSnapshot(restored))
      .toBe(createPersonalSettingsSnapshot(original))
  })

  it('言語コードと省略可能な値を正規化する', () => {
    const original = personalSettings({
      ai_output_language: undefined,
      anki_connect_url: undefined as unknown as string,
      study_languages: [
        { code: 'pt_br', display_name: 'Portuguese', enabled: true, sort_order: 0 },
      ],
    })
    const equivalent = personalSettings({
      ai_output_language: 'vi',
      anki_connect_url: '',
      study_languages: [
        { code: 'pt-BR', display_name: 'Portuguese', enabled: true, sort_order: 0 },
      ],
    })

    expect(createPersonalSettingsSnapshot(equivalent))
      .toBe(createPersonalSettingsSnapshot(original))
  })

  it('学習言語の並び順変更を検出する', () => {
    const original = personalSettings()
    const reordered = personalSettings({
      study_languages: [
        { code: 'ja', display_name: 'Japanese', enabled: true, sort_order: 0 },
        { code: 'en', display_name: 'English', enabled: true, sort_order: 1 },
      ],
    })

    expect(createPersonalSettingsSnapshot(reordered))
      .not.toBe(createPersonalSettingsSnapshot(original))
  })

  it('管理設定の LINE 配信時刻変更を検出する', () => {
    const changed = {
      ...adminSettings,
      lineConfig: {
        ...adminSettings.lineConfig,
        line_schedule_hours: [9],
      },
    }

    expect(createAdminSettingsSnapshot(changed))
      .not.toBe(createAdminSettingsSnapshot(adminSettings))
  })

  it('管理設定の保存対象値の変更を検出する', () => {
    const changed = {
      ...adminSettings,
      aiConfig: { ...adminSettings.aiConfig, web_search_enabled: false },
    }

    expect(createAdminSettingsSnapshot(changed))
      .not.toBe(createAdminSettingsSnapshot(adminSettings))
  })

  it('管理設定の LINE 通知単語数の入力変更を検出する', () => {
    const changed = { ...adminSettings, lineWordsInput: '7' }

    expect(createAdminSettingsSnapshot(changed))
      .not.toBe(createAdminSettingsSnapshot(adminSettings))
  })
})
