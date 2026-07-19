// types/index.ts
// AnkiFlow アプリ全体の TypeScript 型定義

/**
 * Timestamp について:
 * - Server (Node.js/Firebase Admin) では 'firebase-admin/firestore' の Timestamp を使用
 * - Client (Browser) では 'firebase/firestore' の Timestamp を使用
 * 両者に互換させるため、最小限の interface を定義して扱う。
 */
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
}

// ─── Enum Types ───────────────────────────────────────

/**
 * コンテンツのフォーム種別 (Content Type)
 */
export enum FormType {
  LANGUAGE = 'form_language',
  IT = 'form_it',
  GENERAL = 'form_general',
}

/**
 * サポートされる言語
 *
 * @deprecated 学習言語の一覧は現在 user ごとに設定される。既存の 3 つの専用
 * AI/TTS profile を識別する場合にのみこの enum を使うこと。
 */
export enum LanguageType {
  ENGLISH = 'en',
  CHINESE = 'zh',
  JAPANESE = 'ja',
}

/** canonicalize 済みの BCP 47 言語コード。例: `en`, `fr`, `pt-BR`。 */
export type LanguageCode = string

/** user 個人の preferences (`settings/{uid}`) 内の学習言語 1 件。 */
export interface StudyLanguage {
  code: LanguageCode
  display_name: string
  enabled: boolean
  sort_order: number
}

// ─── Collection: entries ──────────────────────────────

/**
 * 作成された語彙/知識 1 件を表す
 */
export interface Entry {
  id?: string; // Document ID trong Firestore
  user_id: string; // Phase 1: 'local-user'. Phase 3: Firebase Auth UID

  // 分類情報
  category_id: string | null;
  language?: LanguageCode | null;
  /** meaning_vi 等の内容に使用した出力言語。未設定の旧 Entry は `vi`。 */
  output_language?: LanguageCode;
  form_type: FormType | string;

  // 共通コンテンツ
  word?: string; // 語彙 (Language)
  term?: string; // 用語 (IT)
  title?: string; // タイトル (General)
  
  meaning_vi?: string; // 出力言語での意味 (既定: ベトナム語)
  definition?: string; // 定義 (IT)
  content?: string; // 詳細内容 (General)
  
  note?: string; // 個人メモ
  word_type?: string; // 品詞 (n, v, adj...)

  // 言語固有 field
  pinyin?: string; // 中国語
  han_viet?: string; // 漢越語 (ベトナム語話者向け)
  hiragana?: string; // 日本語
  katakana?: string; // 日本語
  romaji?: string; // 日本語
  ipa?: string; // 発音記号 (English/All)
  level?: string; // HSK, JLPT, CEFR...

  // 例文 & Collocations
  example_sentence?: string;
  example_translation?: string;
  collocations?: string[];

  // Media (Unsplash/Cloud Storage の URL)
  image_url?: string;
  image_credit?: string;
  audio_url?: string; // TTS で生成した音声ファイルの URL
  audio_example_url?: string;

  // Anki 連携
  anki_deck: string;
  anki_note_ids?: number[]; // Anki 上に作成済みの note ID
  card_type_ids: string[]; // 作成対象に選択された card type
  tags: string[]; // Danh sách tags

  // IT Vocab 固有 field
  keywords?: string[];
  topic_ids?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';

  // SRS
  review_state?: ReviewState;

  // 外部システム連携 (例: Knowledge Hub) — POST /api/integrations/term-drafts 経由で
  // 作成された entry にのみ存在し、UI から通常作成した entry には無い。
  integration_source?: string;
  source_url?: string;
  source_title?: string;
  context_quote?: string;

  // Metadata
  created_at: FirestoreTimestamp;
  updated_at: FirestoreTimestamp;
  status: 'draft' | 'reviewed' | 'synced';
}

// ─── Collection: categories ───────────────────────────

/**
 * 分類カテゴリ (例: 日常、ビジネス...)
 */
export interface Category {
  id: string;
  name: string;
  form_type: FormType;
  sort_order: number;
  is_active: boolean;
  created_at: FirestoreTimestamp;
  updated_at: FirestoreTimestamp;
}

// ─── Card Template (Anki) ─────────────────────────────

export type CardFieldSource =
  | 'word'
  | 'reading'
  | 'han_viet'
  | 'meaning'
  | 'word_type'
  | 'example'
  | 'example_blank'
  | 'translation'
  | 'collocations'
  | 'image'
  | 'audio'

export interface CardTemplate {
  front: CardFieldSource[]
  back: CardFieldSource[]
}

// ─── Collection: card_types ───────────────────────────

/**
 * Anki card type の設定 (例: 単語 → 意味、音声 → 単語...)
 */
export interface CardTypeConfig {
  id: string;
  code: string; // ロジック識別用 code (例: word_to_meaning)
  name: string; // 表示名
  description?: string;
  form_type: FormType;
  language?: LanguageCode | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  template?: CardTemplate;
  created_at: FirestoreTimestamp;
}

// ─── Collection: topics (IT) ──────────────────────────

/**
 * IT 専門トピック (例: Frontend、Backend、Database...)
 */
export interface Topic {
  id: string;
  name: string;
  form_type: FormType;
  is_active: boolean;
  sort_order: number;
  created_at: FirestoreTimestamp;
}

// ─── Collection: decks ────────────────────────────────

/**
 * Anki の Deck 設定とアプリとの紐付け
 */
export interface DeckConfig {
  id: string;
  anki_deck_name: string; // Anki 上の正確な deck 名
  display_name: string; // UI 上の表示名
  form_type: FormType;
  language?: LanguageCode | null;
  default_card_type_ids: string[];
  default_category_id?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: FirestoreTimestamp;
}

// ─── Collection: content_types ────────────────────────

/** AI が生成する 1 field の宣言。 */
export interface AiOutputField {
  key: string;
  type: 'string' | 'string_array';
  /** `{output_language}` / `{study_language}` を解決して tool schema の説明に使用する。 */
  instruction: string;
  /** `output_vi` は出力言語の primary subtag が `vi` の場合だけ field を含める。 */
  include_when?: 'always' | 'output_vi';
  /** `string_array` の出力件数上限。省略時は engine default を使用する。 */
  max_items?: number;
}

/**
 * Content Type の AI output schema variant。
 * `default` は fallback、その他は primary BCP 47 subtag (`en` / `zh` / `ja` など)。
 */
export interface AiOutputProfile {
  profile: string;
  fields: AiOutputField[];
}

/**
 * コンテンツ種別ごとのフォーム UI 設定
 */
export interface ContentType {
  id: string;
  code: FormType | string;
  name: string;
  description: string;
  icon: string;
  fields: FormFieldConfig[];
  /** AI output schema。未設定の legacy document は built-in/dynamic fallback を使用する。 */
  ai_output_profiles?: AiOutputProfile[];
  is_active: boolean;
  sort_order: number;
  /** Create ページでこの content type を選択した時の既定の作成モード。 */
  default_create_mode?: 'single' | 'batch';
  created_at: FirestoreTimestamp;
  updated_at: FirestoreTimestamp;
}

/** ユーザー workspace 内の Content Type snapshot。 */
export interface UserContentType extends ContentType {
  user_id: string;
  source_content_type_id?: string;
}

/**
 * フォーム内の各 field の設定
 */
export interface FormFieldConfig {
  field_key: string; // Entry object 内の field key
  label: string; // 表示ラベル
  type: 'text' | 'textarea' | 'dropdown' | 'checkbox_group' | 'tags' | 'number';
  is_required: boolean;
  is_session_persistent: boolean; // 次回入力のために値を保持するか
  sort_order: number;
  placeholder?: string | null;
  data_source?: string | null; // dropdown/checkbox のデータ取得元 collection 名
  options?: string[]; // data_source を使わない custom dropdown の static options
}

// ─── SRS (Spaced Repetition System) ─────────────────────

export type SRSRating = 'again' | 'hard' | 'good' | 'easy'
export type SRSQueue = 'new' | 'learning' | 'review' | 'relearning'
export type SRSSource = 'anki_sync' | 'builtin' | 'heuristic'

export interface ReviewState {
  ease_factor: number;
  interval_days: number;
  due_date: string;
  lapses: number;
  total_reviews: number;
  last_reviewed_at: string;
  last_rating: SRSRating;
  queue: SRSQueue;
  learning_step: number;
  source: SRSSource;
  synced_at: string;
  /** FSRS (SM-2 の後継、lib/srs/fsrs.ts 参照) — optional: この block を持たない旧 entry や
   * Anki sync 直後の entry は、次回の内部 rate 時に lazy-migrate される。上記 field
   * (ease_factor/interval_days/due_date/lapses/total_reviews/queue) はこの block から
   * 常に同期される "mirror"。 */
  fsrs?: {
    stability: number;
    difficulty: number;
    state: 0 | 1 | 2 | 3; // New/Learning/Review/Relearning — ts-fsrs の State enum に一致
    reps: number;
    scheduled_days: number;
    last_review: string; // ISO
  };
}

// ─── Collection: review_events (append-only, CHỈ server ghi qua Admin SDK) ───
// AnkiFlow の Revlog: review_state の変更 (LINE 経由の rate または Anki からの pull) ごとに
// 1 event を記録する。将来の FSRS/統計/SRS 独立化の基盤 — このログが無いと
// review 履歴は永久に失われる (最新 snapshot しか残らない)。

/** ある時点の ReviewState の重要な scheduler field の snapshot。 */
export type ReviewStateSnapshot = Pick<
  ReviewState,
  'queue' | 'interval_days' | 'ease_factor' | 'due_date' | 'lapses'
>;

export interface ReviewEvent {
  user_id: string;
  entry_id: string;
  kind: 'rating' | 'anki_sync'; // rating = LINE/内部 SRS; anki_sync = Anki からの pull
  rating?: SRSRating; // kind='rating' の時のみ存在
  prev: ReviewStateSnapshot | null; // null = entry に review_state が存在したことがない
  next: ReviewStateSnapshot;
  created_at: string; // ISO
}

// ─── Collection: settings ─────────────────────────────

/**
 * システム設定
 */
export interface Settings {
  unsplash_enabled: boolean;
  tts_enabled: boolean;
  ai_model: string;
  web_search_enabled: boolean;
  anki_connect_url: string;
  allow_duplicate: boolean;
  auto_audio: boolean;
  auto_image: boolean;
  user_name: string;
  notifications_enabled: boolean;
  line_channel_access_token?: string;
  line_user_id?: string;
  /** user が LINE リマインダーを受け取るかどうか。 */
  line_notifications_enabled?: boolean;
  /** リマインダー時刻を解釈するための IANA timezone。 */
  line_timezone?: string;
  /** 同じローカル時刻での重複送信を防止するキー。 */
  line_last_push_key?: string;
  /** 手動テスト送信の cooldown を判定する server timestamp。 */
  line_last_test_at?: FirestoreTimestamp;
  /** user 個人の学習言語一覧; field が無い場合 → legacy defaults を使用。 */
  study_languages?: StudyLanguage[];
  /** AI 出力に使用する canonical BCP 47 言語。未設定時は `vi`。 */
  ai_output_language?: string;
  /** 次回の browser-side Sync で削除する Anki note ID の retry queue。 */
  pending_anki_note_deletions?: number[];
  updated_at: FirestoreTimestamp;
}

/**
 * `settings/global` — admin が管理するグローバル feature flags (control plane)。
 * ログイン済み user は全員読める (client SDK、secret なし); 書き込みは admin のみ
 * (qua POST /api/admin/global-config, verify server-side theo ADMIN_EMAIL).
 */
export interface GlobalSettings {
  ai_model: string;
  web_search_enabled: boolean;
  tts_available: boolean;
  unsplash_available: boolean;
  line_notifications_available?: boolean;
  line_schedule_hours?: number[];
  line_words_per_notification?: number;
  updated_at: FirestoreTimestamp;
}

// ─── Session State (localStorage) ─────────────────────

/**
 * 現在の作業セッション状態。localStorage に保存
 */
export interface SessionState {
  form_type: FormType;
  language?: LanguageCode | null;
  anki_deck?: string | null;
  category_id?: string | null;
  tags?: string[];
  card_type_ids?: string[];
  topic_ids?: string[];
  difficulty?: string | null;
  last_updated: string; // ISO Date string
}
