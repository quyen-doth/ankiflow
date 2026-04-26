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
  LANGUAGE = 'language',
  IT = 'it',
  GENERAL = 'general',
  CUSTOM = 'custom',
}

/**
 * Ngôn ngữ được hỗ trợ
 */
export enum LanguageType {
  ENGLISH = 'english',
  CHINESE = 'chinese',
  JAPANESE = 'japanese',
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
  language?: LanguageType | null;
  form_type: FormType;

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
  language?: LanguageType | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
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
  language?: LanguageType | null;
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
  code: FormType;
  name: string;
  description: string;
  icon: string;
  fields: FormFieldConfig[];
  is_active: boolean;
  sort_order: number;
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

// ─── Collection: settings ─────────────────────────────

/**
 * Cài đặt hệ thống
 */
export interface Settings {
  unsplash_enabled: boolean;
  tts_enabled: boolean;
  gemini_model: string;
  anki_connect_url: string;
  allow_duplicate: boolean;
  auto_audio: boolean;
  auto_image: boolean;
  updated_at: FirestoreTimestamp;
}

// ─── Session State (localStorage) ─────────────────────

/**
 * Trạng thái phiên làm việc hiện tại, lưu vào localStorage
 */
export interface SessionState {
  form_type: FormType;
  language?: LanguageType | null;
  anki_deck?: string | null;
  category_id?: string | null;
  tags?: string[];
  card_type_ids?: string[];
  topic_ids?: string[];
  difficulty?: string | null;
  last_updated: string; // ISO Date string
}
