// types/index.ts
// TypeScript type definitions cho toàn bộ ứng dụng AnkiFlow

/**
 * Lưu ý về Timestamp:
 * - Khi chạy ở Server (Node.js/Firebase Admin): dùng Timestamp từ 'firebase-admin/firestore'
 * - Khi chạy ở Client (Browser): dùng Timestamp từ 'firebase/firestore'
 * Để đơn giản và tương thích cả hai, chúng ta định nghĩa một interface tối thiểu hoặc dùng any.
 */
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
  toDate(): Date;
}

// ─── Enum Types ───────────────────────────────────────

/**
 * Loại form nội dung (Content Type)
 */
export enum FormType {
  LANGUAGE = 'form_language',
  IT = 'form_it',
  GENERAL = 'form_general',
}

/**
 * Ngôn ngữ được hỗ trợ
 *
 * @deprecated Danh sách ngôn ngữ học hiện do từng user cấu hình. Chỉ dùng enum
 * này khi cần nhận diện ba profile AI/TTS chuyên biệt đã có từ trước.
 */
export enum LanguageType {
  ENGLISH = 'en',
  CHINESE = 'zh',
  JAPANESE = 'ja',
}

/** Mã ngôn ngữ BCP 47 đã được canonicalize, ví dụ `en`, `fr`, `pt-BR`. */
export type LanguageCode = string

/** Một ngôn ngữ học trong preferences riêng của user (`settings/{uid}`). */
export interface StudyLanguage {
  code: LanguageCode
  display_name: string
  enabled: boolean
  sort_order: number
}

// ─── Collection: entries ──────────────────────────────

/**
 * Đại diện cho một mục từ vựng/kiến thức được tạo ra
 */
export interface Entry {
  id?: string; // Document ID trong Firestore
  user_id: string; // Phase 1: 'local-user'. Phase 3: Firebase Auth UID

  // Thông tin phân loại
  category_id: string | null;
  language?: LanguageCode | null;
  /** meaning_vi 等の内容に使用した出力言語。未設定の旧 Entry は `vi`。 */
  output_language?: LanguageCode;
  form_type: FormType | string;

  // Nội dung chung
  word?: string; // Từ vựng (Language)
  term?: string; // Thuật ngữ (IT)
  title?: string; // Tiêu đề (General)
  
  meaning_vi?: string; // Nghĩa tiếng Việt
  definition?: string; // Định nghĩa (IT)
  content?: string; // Nội dung chi tiết (General)
  
  note?: string; // Ghi chú cá nhân
  word_type?: string; // Loại từ (n, v, adj...)

  // Ngôn ngữ đặc thù
  pinyin?: string; // Tiếng Trung
  han_viet?: string; // Hán Việt
  hiragana?: string; // Tiếng Nhật
  katakana?: string; // Tiếng Nhật
  romaji?: string; // Tiếng Nhật
  ipa?: string; // Phiên âm (English/All)
  level?: string; // HSK, JLPT, CEFR...

  // Ví dụ & Collocations
  example_sentence?: string;
  example_translation?: string;
  collocations?: string[];

  // Media (URL từ Unsplash/Cloud Storage)
  image_url?: string;
  image_credit?: string;
  audio_url?: string; // URL file âm thanh từ TTS
  audio_example_url?: string;

  // Liên kết Anki
  anki_deck: string;
  anki_note_ids?: number[]; // ID của các note đã tạo trong Anki
  card_type_ids: string[]; // Các loại card được chọn tạo
  tags: string[]; // Danh sách tags

  // IT Vocab đặc thù
  keywords?: string[];
  topic_ids?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';

  // SRS
  review_state?: ReviewState;

  // Tích hợp từ hệ thống ngoài (vd Knowledge Hub) — chỉ có khi entry được tạo qua
  // POST /api/integrations/term-drafts, không có ở entry tạo bình thường qua UI.
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
 * Danh mục phân loại (vd: Đời sống, Kinh doanh...)
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
 * Cấu hình loại thẻ Anki (vd: Từ -> Nghĩa, Nghe -> Từ...)
 */
export interface CardTypeConfig {
  id: string;
  code: string; // Mã code định danh logic (vd: word_to_meaning)
  name: string; // Tên hiển thị
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
 * Chủ đề chuyên ngành IT (vd: Frontend, Backend, Database...)
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
 * Cấu hình Deck trong Anki và liên kết với App
 */
export interface DeckConfig {
  id: string;
  anki_deck_name: string; // Tên deck chính xác trong Anki
  display_name: string; // Tên hiển thị trên UI
  form_type: FormType;
  language?: LanguageCode | null;
  default_card_type_ids: string[];
  default_category_id?: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: FirestoreTimestamp;
}

// ─── Collection: content_types ────────────────────────

/**
 * Cấu hình giao diện Form cho từng loại nội dung
 */
export interface ContentType {
  id: string;
  code: FormType | string;
  name: string;
  description: string;
  icon: string;
  fields: FormFieldConfig[];
  is_active: boolean;
  sort_order: number;
  /** Chế độ tạo thẻ mặc định khi chọn content type này trong trang Create. */
  default_create_mode?: 'single' | 'batch';
  created_at: FirestoreTimestamp;
  updated_at: FirestoreTimestamp;
}

/**
 * Cấu hình từng trường (field) trong Form
 */
export interface FormFieldConfig {
  field_key: string; // Key của field trong object Entry
  label: string; // Nhãn hiển thị
  type: 'text' | 'textarea' | 'dropdown' | 'checkbox_group' | 'tags' | 'number';
  is_required: boolean;
  is_session_persistent: boolean; // Có lưu lại giá trị cho lần nhập sau không
  sort_order: number;
  placeholder?: string | null;
  data_source?: string | null; // Tên collection để lấy dữ liệu cho dropdown/checkbox
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
  /** FSRS (thay SM-2, xem lib/srs/fsrs.ts) — optional: entry cũ/vừa sync Anki chưa có block
   * này sẽ được lazy-migrate ở lần rate nội bộ kế tiếp. Field trên (ease_factor/interval_days/
   * due_date/lapses/total_reviews/queue) vẫn là "mirror" luôn đồng bộ từ block này. */
  fsrs?: {
    stability: number;
    difficulty: number;
    state: 0 | 1 | 2 | 3; // New/Learning/Review/Relearning — khớp ts-fsrs State enum
    reps: number;
    scheduled_days: number;
    last_review: string; // ISO
  };
}

// ─── Collection: review_events (append-only, CHỈ server ghi qua Admin SDK) ───
// Revlog của AnkiFlow: mỗi thay đổi review_state (rate qua LINE hoặc pull từ Anki)
// được ghi lại 1 event. Nền tảng cho FSRS/thống kê/độc lập SRS sau này — không có
// log này thì lịch sử review mất vĩnh viễn (chỉ còn snapshot mới nhất).

/** Snapshot các field scheduler quan trọng của ReviewState tại 1 thời điểm. */
export type ReviewStateSnapshot = Pick<
  ReviewState,
  'queue' | 'interval_days' | 'ease_factor' | 'due_date' | 'lapses'
>;

export interface ReviewEvent {
  user_id: string;
  entry_id: string;
  kind: 'rating' | 'anki_sync'; // rating = LINE/SM-2 nội bộ; anki_sync = pull từ Anki
  rating?: SRSRating; // chỉ có với kind='rating'
  prev: ReviewStateSnapshot | null; // null = entry chưa từng có review_state
  next: ReviewStateSnapshot;
  created_at: string; // ISO
}

// ─── Collection: notification_triggers ───────────────────

export interface NotificationTrigger {
  id: string;
  type: 'vocab_review';
  name: string;
  schedule_hours: number[];
  timezone: string;
  deck_filter: string[];
  language_filter: string[];
  words_per_notification: number;
  is_active: boolean;
  created_at: FirestoreTimestamp;
  updated_at: FirestoreTimestamp;
}

// ─── Collection: settings ─────────────────────────────

/**
 * Cài đặt hệ thống
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
  /** Danh sách ngôn ngữ học riêng của user; thiếu field → dùng legacy defaults. */
  study_languages?: StudyLanguage[];
  /** AI 出力に使用する canonical BCP 47 言語。未設定時は `vi`。 */
  ai_output_language?: string;
  updated_at: FirestoreTimestamp;
}

/**
 * `settings/global` — feature flags toàn cục do admin kiểm soát (control plane).
 * Mọi user đã đăng nhập đọc được (client SDK, không secret); chỉ admin ghi được
 * (qua POST /api/admin/global-config, verify server-side theo ADMIN_EMAIL).
 */
export interface GlobalSettings {
  ai_model: string;
  web_search_enabled: boolean;
  tts_available: boolean;
  unsplash_available: boolean;
  updated_at: FirestoreTimestamp;
}

// ─── Session State (localStorage) ─────────────────────

/**
 * Trạng thái phiên làm việc hiện tại, lưu vào localStorage
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
