/**
 * User ID mặc định cho chế độ single-user local.
 * Phase 3: Thay bằng Firebase Auth UID từ session.
 * Tìm kiếm "LOCAL_USER_ID" trong codebase để biết nơi cần cập nhật.
 */
export const LOCAL_USER_ID = 'local-user' as const

export const DEFAULT_STATUS = 'draft' as const

/**
 * Document ID của settings singleton trong Firestore.
 * `settings` chỉ có 1 document duy nhất — không bao giờ tạo mới, chỉ update.
 */
export const SETTINGS_DOC_ID = 'default' as const

/**
 * Document chứa feature flags TOÀN CỤC (ai_model, web_search_enabled, tts_available,
 * unsplash_available) — mọi user đã đăng nhập ĐỌC được (client SDK), CHỈ admin GHI được
 * (qua POST /api/admin/global-config, verify server-side). Tách khỏi `settings/default`
 * (chứa secrets: LINE credentials) để tránh lộ secrets khi client đọc flags.
 */
export const GLOBAL_SETTINGS_DOC_ID = 'global' as const

/**
 * Giá trị `user_id` đặc biệt đánh dấu "template" — bộ master data (categories/
 * card_types/topics/decks) admin sửa qua /admin ở chế độ "New-user defaults".
 * `seedUserDefaults` clone từ đây cho user mới; không phải UID thật nên không đụng
 * dữ liệu của user nào.
 */
export const DEFAULTS_OWNER_ID = '__defaults__' as const

// ─── Form Type Mapping ───────────────────────────────────────────────────────
import { FormType, LanguageType } from '@/types'

/**
 * Nhãn UI (dùng cho state, props) → FormType enum (dùng cho Firestore query)
 * Dùng hàm này thay vì hardcode map trong từng component.
 */
export const UI_FORM_TYPE_MAP: Record<'Language' | 'IT' | 'General', FormType> = {
  Language: FormType.LANGUAGE,
  IT: FormType.IT,
  General: FormType.GENERAL,
}

/**
 * FormType enum → nhãn UI (reverse lookup)
 */
export const DB_FORM_TYPE_TO_UI: Record<FormType, 'Language' | 'IT' | 'General'> = {
  [FormType.LANGUAGE]: 'Language',
  [FormType.IT]: 'IT',
  [FormType.GENERAL]: 'General',
}

// ─── Language Options ────────────────────────────────────────────────────────

/**
 * Danh sách ngôn ngữ hỗ trợ — nguồn duy nhất cho LanguageSelector.
 * Dùng LanguageType enum để đảm bảo khớp với Firestore.
 */
export const LANGUAGE_OPTIONS: { id: LanguageType; name: string; flag: string }[] = [
  { id: LanguageType.ENGLISH, name: 'English', flag: '🇺🇸' },
  { id: LanguageType.JAPANESE, name: 'Japanese', flag: '🇯🇵' },
  { id: LanguageType.CHINESE, name: 'Chinese', flag: '🇨🇳' },
]
