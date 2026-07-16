import { canonicalizeLanguageCode, normalizeStudyLanguages } from '@/lib/studyLanguages'
import type { Settings } from '@/types'

export interface FeatureFlagsForm {
  tts_available: boolean
  unsplash_available: boolean
}

export interface AiConfigForm {
  ai_model: string
  web_search_enabled: boolean
}

export interface LineConfigForm {
  line_notifications_available: boolean
  line_schedule_hours: number[]
}

interface AdminSettingsForm {
  featureFlags: FeatureFlagsForm
  aiConfig: AiConfigForm
  lineConfig: LineConfigForm
  lineWordsInput: string
}

export function createPersonalSettingsSnapshot(settings: Settings): string {
  return JSON.stringify({
    unsplash_enabled: Boolean(settings.unsplash_enabled),
    tts_enabled: Boolean(settings.tts_enabled),
    auto_audio: Boolean(settings.auto_audio),
    auto_image: Boolean(settings.auto_image),
    allow_duplicate: Boolean(settings.allow_duplicate),
    anki_connect_url: settings.anki_connect_url ?? '',
    study_languages: normalizeStudyLanguages(settings.study_languages).map(language => ({
      code: language.code,
      display_name: language.display_name,
      enabled: language.enabled,
      sort_order: language.sort_order,
    })),
    ai_output_language: canonicalizeLanguageCode(settings.ai_output_language ?? '') ?? 'vi',
  })
}

export function createAdminSettingsSnapshot({
  featureFlags,
  aiConfig,
  lineConfig,
  lineWordsInput,
}: AdminSettingsForm): string {
  return JSON.stringify({
    tts_available: featureFlags.tts_available,
    unsplash_available: featureFlags.unsplash_available,
    ai_model: aiConfig.ai_model,
    web_search_enabled: aiConfig.web_search_enabled,
    line_notifications_available: lineConfig.line_notifications_available,
    line_schedule_hours: lineConfig.line_schedule_hours,
    line_words_per_notification: lineWordsInput,
  })
}
