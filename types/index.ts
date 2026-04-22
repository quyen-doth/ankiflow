// types/index.ts
// TypeScript type definitions cho toàn bộ ứng dụng AnkiFlow

import { Timestamp } from 'firebase-admin/firestore';

// ─── Enum Types ───────────────────────────────────────

export type FormType = 'language' | 'it' | 'general' | 'custom';

export type LanguageType = 'english' | 'chinese' | 'japanese';

// ─── Collection: entries ──────────────────────────────

export interface Entry {
  id: string;

  // Thông tin cơ bản
  category_id: string;
  language?: LanguageType;
  form_type: FormType;

  // Nội dung
  word: string;
  meaning_vi: string;
  word_type?: string;

  // Ngôn ngữ đặc thù
  pinyin?: string;
  han_viet?: string;
  hiragana?: string;
  katakana?: string;
  romaji?: string;
  ipa?: string;
  level?: string;

  // Ví dụ & Collocations
  example_sentence?: string;
  example_translation?: string;
  collocations?: string[];

  // Media
  image_url?: string;
  image_credit?: string;
  audio_filename?: string;
  audio_example_filename?: string;

  // Anki
  anki_deck: string;
  anki_note_ids: number[];
  card_types_created: string[];
  anki_tags: string[];

  // IT Vocab
  keywords?: string[];
  topic_ids?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';

  // Metadata
  created_at: Timestamp;
  updated_at: Timestamp;
  status: 'draft' | 'reviewed' | 'synced';
}

// ─── Collection: categories ───────────────────────────

export interface Category {
  id: string;
  name: string;
  form_type: FormType;
  sort_order: number;
  is_active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ─── Collection: card_types ───────────────────────────

export interface CardTypeConfig {
  id: string;
  code: string;
  name: string;
  description: string;
  form_type: FormType;
  language?: LanguageType | null;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: Timestamp;
}

// ─── Collection: topics (IT) ──────────────────────────

export interface Topic {
  id: string;
  name: string;
  form_type: FormType;
  is_active: boolean;
  sort_order: number;
  created_at: Timestamp;
}

// ─── Collection: decks ────────────────────────────────

export interface DeckConfig {
  id: string;
  anki_deck_name: string;
  display_name: string;
  form_type: FormType;
  language?: LanguageType | null;
  default_card_type_ids: string[];
  default_category_id?: string;
  is_active: boolean;
  sort_order: number;
  created_at: Timestamp;
}

// ─── Collection: content_types ────────────────────────

export interface ContentType {
  id: string;
  code: FormType;
  name: string;
  description: string;
  icon: string;
  fields: FormFieldConfig[];
  is_active: boolean;
  sort_order: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface FormFieldConfig {
  field_key: string;
  label: string;
  type: 'text' | 'textarea' | 'dropdown' | 'checkbox_group' | 'tags';
  is_required: boolean;
  is_session_persistent: boolean;
  sort_order: number;
  placeholder?: string;
  data_source?: string;
}

// ─── Collection: settings ─────────────────────────────

export interface Settings {
  unsplash_enabled: boolean;
  tts_enabled: boolean;
  gemini_model: string;
  anki_connect_url: string;
  allow_duplicate: boolean;
  auto_audio: boolean;
  auto_image: boolean;
  updated_at: Timestamp;
}

// ─── Session State (localStorage) ─────────────────────

export interface SessionState {
  form_type: FormType;
  language?: LanguageType;
  anki_deck?: string;
  category_id?: string;
  tags?: string[];
  card_type_ids?: string[];
  topic_ids?: string[];
  difficulty?: string;
  last_updated: string;
}
