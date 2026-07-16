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

export interface LineSecretsForm {
  notifications_enabled: boolean
  line_channel_access_token?: string
  line_user_id?: string
}

interface AdminSettingsForm {
  featureFlags: FeatureFlagsForm
  aiConfig: AiConfigForm
  lineSecrets: LineSecretsForm
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
  lineSecrets,
}: AdminSettingsForm): string {
  return JSON.stringify({
    tts_available: featureFlags.tts_available,
    unsplash_available: featureFlags.unsplash_available,
    ai_model: aiConfig.ai_model,
    web_search_enabled: aiConfig.web_search_enabled,
    notifications_enabled: lineSecrets.notifications_enabled,
    line_channel_access_token: lineSecrets.line_channel_access_token ?? '',
    line_user_id: lineSecrets.line_user_id ?? '',
  })
}
