/**
 * single-user local モード用のデフォルト User ID。
 * Phase 3: session からの Firebase Auth UID に置き換える。
 * どこを更新すべきか知るには codebase 内で "LOCAL_USER_ID" を検索。
 */
export const LOCAL_USER_ID = 'local-user' as const

export const DEFAULT_STATUS = 'draft' as const

/**
 * Firestore 内の settings シングルトンの Document ID。
 * `settings` は 1 つのドキュメントのみ — 新規作成せず、update のみ。
 */
export const SETTINGS_DOC_ID = 'default' as const

/**
 * グローバルなフィーチャーフラグ (ai_model、web_search_enabled、tts_available、
 * unsplash_available) を含む Document — ログイン済みの全ユーザーが読み取り可能 (client SDK)、
 * admin のみ書き込み可能 (POST /api/admin/global-config 経由、サーバー側で検証)。
 * flags をクライアントが読む際に secrets が漏れないよう、`settings/default`
 * (secrets を含む: LINE credentials) とは分離。
 */
export const GLOBAL_SETTINGS_DOC_ID = 'global' as const

/**
 * "template" を示す特別な `user_id` の値 — admin が /admin の "New-user defaults"
 * モードで編集するマスターデータ (categories/card_types/topics/decks) 一式。
 * `seedUserDefaults` はここから新規ユーザー用にクローンする; 実際の UID ではないため
 * どのユーザーのデータにも影響しない。
 */
export const DEFAULTS_OWNER_ID = '__defaults__' as const

// ─── Form Type Mapping ───────────────────────────────────────────────────────
import { FormType } from '@/types'

export const GLOBAL_CONTENT_TYPES_COLLECTION = 'content_types' as const
export const USER_CONTENT_TYPES_COLLECTION = 'user_content_types' as const

export const PROTECTED_GLOBAL_CONTENT_TYPE_IDS = [
  FormType.LANGUAGE,
  FormType.IT,
  FormType.GENERAL,
] as const

export const CONTENT_TYPE_CODE_PATTERN = /^[a-z][a-z0-9_]*$/

/**
 * UI ラベル (state、props で使用) → FormType enum (Firestore クエリで使用)
 * 各コンポーネントで map をハードコードする代わりにこの関数を使う。
 */
export const UI_FORM_TYPE_MAP: Record<'Language' | 'IT' | 'General', FormType> = {
  Language: FormType.LANGUAGE,
  IT: FormType.IT,
  General: FormType.GENERAL,
}

/**
 * FormType enum → UI ラベル (reverse lookup)
 */
export const DB_FORM_TYPE_TO_UI: Record<FormType, 'Language' | 'IT' | 'General'> = {
  [FormType.LANGUAGE]: 'Language',
  [FormType.IT]: 'IT',
  [FormType.GENERAL]: 'General',
}
