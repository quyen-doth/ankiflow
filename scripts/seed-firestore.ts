/**
 * scripts/seed-firestore.ts
 * Seed dữ liệu mặc định vào Firestore
 * 
 * Cách chạy: npm run seed
 * Yêu cầu: Anki chưa cần chạy, chỉ cần Firebase credentials trong .env.local
 * Idempotent: chạy nhiều lần không bị lỗi, bỏ qua document đã tồn tại
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Khởi tạo Firebase Admin
const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

const db = getFirestore(app);
const now = Timestamp.now();

// ─── Helper: tạo document nếu chưa tồn tại ──────────────
async function seedDoc(collection: string, id: string, data: Record<string, unknown>) {
  const ref = db.collection(collection).doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`  ⏭️  ${collection}/${id} — đã tồn tại, bỏ qua`);
    return;
  }
  await ref.set(data);
  console.log(`  ✅ ${collection}/${id} — đã tạo`);
}

// ─── 1. CATEGORIES ───────────────────────────────────────
async function seedCategories() {
  console.log('\n📂 Seeding categories...');

  const languageCategories = [
    { id: 'cat_daily',    name: 'Đời sống',      sort_order: 1 },
    { id: 'cat_business', name: 'Kinh doanh',    sort_order: 2 },
    { id: 'cat_travel',   name: 'Du lịch',       sort_order: 3 },
    { id: 'cat_food',     name: 'Ẩm thực',       sort_order: 4 },
    { id: 'cat_tech',     name: 'Công nghệ',     sort_order: 5 },
    { id: 'cat_edu',      name: 'Giáo dục',      sort_order: 6 },
    { id: 'cat_health',   name: 'Y tế',          sort_order: 7 },
    { id: 'cat_culture',  name: 'Văn hóa',       sort_order: 8 },
    { id: 'cat_nature',   name: 'Thiên nhiên',   sort_order: 9 },
    { id: 'cat_emotion',  name: 'Cảm xúc',       sort_order: 10 },
  ];

  for (const cat of languageCategories) {
    await seedDoc('categories', cat.id, {
      name: cat.name,
      form_type: 'language',
      sort_order: cat.sort_order,
      is_active: true,
      created_at: now,
      updated_at: now,
    });
  }
}

// ─── 2. CARD TYPES ───────────────────────────────────────
async function seedCardTypes() {
  console.log('\n🃏 Seeding card_types...');

  const cardTypes = [
    // Language — dùng cho tất cả ngôn ngữ
    { id: 'ct_word_meaning',  code: 'word_to_meaning',  name: 'Từ → Nghĩa VN',         form_type: 'language', language: null,      is_default: true,  sort_order: 1 },
    { id: 'ct_meaning_word',  code: 'meaning_to_word',  name: 'Nghĩa VN → Từ',         form_type: 'language', language: null,      is_default: true,  sort_order: 2 },
    { id: 'ct_audio_word',    code: 'audio_to_word',    name: 'Nghe → Đoán từ',        form_type: 'language', language: null,      is_default: true,  sort_order: 3 },
    { id: 'ct_image_word',    code: 'image_to_word',    name: 'Ảnh → Đoán từ',         form_type: 'language', language: null,      is_default: true,  sort_order: 4 },
    { id: 'ct_fill_blank',    code: 'fill_in_blank',    name: 'Điền vào chỗ trống',    form_type: 'language', language: null,      is_default: true,  sort_order: 5 },
    // Chinese specific
    { id: 'ct_pinyin_char',   code: 'reading_to_word',  name: 'Pinyin → Chữ Hán',      form_type: 'language', language: 'chinese', is_default: false, sort_order: 6 },
    { id: 'ct_char_pinyin',   code: 'word_to_reading',  name: 'Chữ Hán → Pinyin',      form_type: 'language', language: 'chinese', is_default: false, sort_order: 7 },
    // Japanese specific
    { id: 'ct_hira_kanji',    code: 'reading_to_word',  name: 'Hiragana → Kanji',      form_type: 'language', language: 'japanese',is_default: false, sort_order: 6 },
    { id: 'ct_kanji_hira',    code: 'word_to_reading',  name: 'Kanji → Hiragana',      form_type: 'language', language: 'japanese',is_default: false, sort_order: 7 },
    // IT Vocabulary
    { id: 'ct_concept_def',   code: 'concept_to_def',   name: 'Khái niệm → Định nghĩa',form_type: 'it',       language: null,      is_default: true,  sort_order: 1 },
    { id: 'ct_def_concept',   code: 'def_to_concept',   name: 'Định nghĩa → Khái niệm',form_type: 'it',       language: null,      is_default: true,  sort_order: 2 },
    // General
    { id: 'ct_front_back',    code: 'front_to_back',    name: 'Mặt trước → Mặt sau',   form_type: 'general',  language: null,      is_default: true,  sort_order: 1 },
  ];

  for (const ct of cardTypes) {
    await seedDoc('card_types', ct.id, {
      code: ct.code,
      name: ct.name,
      description: '',
      form_type: ct.form_type,
      language: ct.language,
      is_default: ct.is_default,
      is_active: true,
      sort_order: ct.sort_order,
      created_at: now,
    });
  }
}

// ─── 3. TOPICS (IT) ──────────────────────────────────────
async function seedTopics() {
  console.log('\n🏷️  Seeding topics...');

  const topics = [
    { id: 'topic_db',    name: 'Database',      sort_order: 1 },
    { id: 'topic_fe',    name: 'Frontend',      sort_order: 2 },
    { id: 'topic_be',    name: 'Backend',       sort_order: 3 },
    { id: 'topic_algo',  name: 'Algorithm',     sort_order: 4 },
    { id: 'topic_devops',name: 'DevOps',        sort_order: 5 },
    { id: 'topic_sec',   name: 'Security',      sort_order: 6 },
    { id: 'topic_arch',  name: 'Architecture',  sort_order: 7 },
    { id: 'topic_net',   name: 'Network',       sort_order: 8 },
    { id: 'topic_os',    name: 'OS',            sort_order: 9 },
    { id: 'topic_ds',    name: 'Data Science',  sort_order: 10 },
    { id: 'topic_mobile',name: 'Mobile',        sort_order: 11 },
    { id: 'topic_ai',    name: 'AI / ML',       sort_order: 12 },
  ];

  for (const topic of topics) {
    await seedDoc('topics', topic.id, {
      name: topic.name,
      form_type: 'it',
      is_active: true,
      sort_order: topic.sort_order,
      created_at: now,
    });
  }
}

// ─── 4. DECKS ─────────────────────────────────────────────
async function seedDecks() {
  console.log('\n🗂️  Seeding decks...');

  const decks = [
    // Tiếng Trung
    {
      id: 'deck_zh_hsk1',
      anki_deck_name: 'Language::Chinese::HSK1',
      display_name: 'Tiếng Trung HSK1',
      form_type: 'language',
      language: 'chinese',
      default_card_type_ids: ['ct_word_meaning', 'ct_meaning_word', 'ct_audio_word', 'ct_image_word', 'ct_fill_blank'],
      default_category_id: 'cat_daily',
      sort_order: 1,
    },
    {
      id: 'deck_zh_hsk2',
      anki_deck_name: 'Language::Chinese::HSK2',
      display_name: 'Tiếng Trung HSK2',
      form_type: 'language',
      language: 'chinese',
      default_card_type_ids: ['ct_word_meaning', 'ct_meaning_word', 'ct_audio_word', 'ct_image_word', 'ct_fill_blank'],
      default_category_id: 'cat_daily',
      sort_order: 2,
    },
    {
      id: 'deck_zh_hsk3',
      anki_deck_name: 'Language::Chinese::HSK3',
      display_name: 'Tiếng Trung HSK3',
      form_type: 'language',
      language: 'chinese',
      default_card_type_ids: ['ct_word_meaning', 'ct_meaning_word', 'ct_audio_word', 'ct_fill_blank'],
      default_category_id: 'cat_daily',
      sort_order: 3,
    },
    // Tiếng Nhật
    {
      id: 'deck_ja_n5',
      anki_deck_name: 'Language::Japanese::N5',
      display_name: 'Tiếng Nhật N5',
      form_type: 'language',
      language: 'japanese',
      default_card_type_ids: ['ct_word_meaning', 'ct_meaning_word', 'ct_audio_word', 'ct_image_word', 'ct_fill_blank'],
      default_category_id: 'cat_daily',
      sort_order: 4,
    },
    {
      id: 'deck_ja_n4',
      anki_deck_name: 'Language::Japanese::N4',
      display_name: 'Tiếng Nhật N4',
      form_type: 'language',
      language: 'japanese',
      default_card_type_ids: ['ct_word_meaning', 'ct_meaning_word', 'ct_audio_word', 'ct_fill_blank'],
      default_category_id: 'cat_daily',
      sort_order: 5,
    },
    // Tiếng Anh
    {
      id: 'deck_en_b1',
      anki_deck_name: 'Language::English::B1',
      display_name: 'Tiếng Anh B1',
      form_type: 'language',
      language: 'english',
      default_card_type_ids: ['ct_word_meaning', 'ct_meaning_word', 'ct_audio_word', 'ct_image_word', 'ct_fill_blank'],
      default_category_id: 'cat_daily',
      sort_order: 6,
    },
    {
      id: 'deck_en_b2',
      anki_deck_name: 'Language::English::B2',
      display_name: 'Tiếng Anh B2',
      form_type: 'language',
      language: 'english',
      default_card_type_ids: ['ct_word_meaning', 'ct_meaning_word', 'ct_audio_word', 'ct_fill_blank'],
      default_category_id: 'cat_daily',
      sort_order: 7,
    },
    // IT Vocabulary
    {
      id: 'deck_it',
      anki_deck_name: 'Vocabulary::IT',
      display_name: 'IT Vocabulary',
      form_type: 'it',
      language: null,
      default_card_type_ids: ['ct_concept_def', 'ct_def_concept'],
      default_category_id: null,
      sort_order: 8,
    },
    // General
    {
      id: 'deck_general',
      anki_deck_name: 'Vocabulary::General',
      display_name: 'Kiến thức chung',
      form_type: 'general',
      language: null,
      default_card_type_ids: ['ct_front_back'],
      default_category_id: null,
      sort_order: 9,
    },
  ];

  for (const deck of decks) {
    await seedDoc('decks', deck.id, {
      anki_deck_name: deck.anki_deck_name,
      display_name: deck.display_name,
      form_type: deck.form_type,
      language: deck.language,
      default_card_type_ids: deck.default_card_type_ids,
      default_category_id: deck.default_category_id,
      is_active: true,
      sort_order: deck.sort_order,
      created_at: now,
    });
  }
}

// ─── 5. CONTENT TYPES (Form config) ──────────────────────
async function seedContentTypes() {
  console.log('\n📋 Seeding content_types...');

  const contentTypes = [
    {
      id: 'form_language',
      code: 'language',
      name: 'Ngôn ngữ',
      description: 'Từ vựng tiếng Anh, Trung, Nhật',
      icon: '🌍',
      sort_order: 1,
      fields: [
        { field_key: 'language',       label: 'Ngôn ngữ',    type: 'dropdown',       is_required: true,  is_session_persistent: true,  sort_order: 1, data_source: null,           placeholder: null },
        { field_key: 'anki_deck',      label: 'Anki Deck',   type: 'dropdown',       is_required: true,  is_session_persistent: true,  sort_order: 2, data_source: 'decks',        placeholder: null },
        { field_key: 'category_id',    label: 'Category',    type: 'dropdown',       is_required: false, is_session_persistent: true,  sort_order: 3, data_source: 'categories',   placeholder: null },
        { field_key: 'tags',           label: 'Tags',        type: 'tags',           is_required: false, is_session_persistent: true,  sort_order: 4, data_source: null,           placeholder: 'Thêm tag...' },
        { field_key: 'word',           label: 'Từ vựng',     type: 'text',           is_required: true,  is_session_persistent: false, sort_order: 5, data_source: null,           placeholder: 'Nhập từ vựng...' },
        { field_key: 'note',           label: 'Ghi chú',     type: 'text',           is_required: false, is_session_persistent: false, sort_order: 6, data_source: null,           placeholder: 'Ghi chú cá nhân (optional)' },
        { field_key: 'card_type_ids',  label: 'Loại card',   type: 'checkbox_group', is_required: false, is_session_persistent: true,  sort_order: 7, data_source: 'card_types',   placeholder: null },
      ],
    },
    {
      id: 'form_it',
      code: 'it',
      name: 'IT Vocabulary',
      description: 'Thuật ngữ lập trình, công nghệ',
      icon: '💻',
      sort_order: 2,
      fields: [
        { field_key: 'anki_deck',      label: 'Anki Deck',       type: 'dropdown',       is_required: true,  is_session_persistent: true,  sort_order: 1, data_source: 'decks',      placeholder: null },
        { field_key: 'topic_ids',      label: 'Chủ đề',          type: 'checkbox_group', is_required: false, is_session_persistent: true,  sort_order: 2, data_source: 'topics',     placeholder: null },
        { field_key: 'difficulty',     label: 'Độ khó',          type: 'dropdown',       is_required: false, is_session_persistent: true,  sort_order: 3, data_source: null,         placeholder: null },
        { field_key: 'term',           label: 'Thuật ngữ',       type: 'text',           is_required: true,  is_session_persistent: false, sort_order: 4, data_source: null,         placeholder: 'Ví dụ: REST API, Docker...' },
        { field_key: 'definition',     label: 'Định nghĩa ngắn', type: 'text',           is_required: true,  is_session_persistent: false, sort_order: 5, data_source: null,         placeholder: 'Mô tả ngắn gọn bằng tiếng Việt...' },
        { field_key: 'keywords',       label: 'Keywords',        type: 'tags',           is_required: false, is_session_persistent: false, sort_order: 6, data_source: null,         placeholder: 'Thêm keyword liên quan...' },
        { field_key: 'card_type_ids',  label: 'Loại card',       type: 'checkbox_group', is_required: false, is_session_persistent: true,  sort_order: 7, data_source: 'card_types', placeholder: null },
      ],
    },
    {
      id: 'form_general',
      code: 'general',
      name: 'Kiến thức chung',
      description: 'Bất kỳ nội dung nào khác',
      icon: '📚',
      sort_order: 3,
      fields: [
        { field_key: 'anki_deck', label: 'Anki Deck',         type: 'dropdown',  is_required: true,  is_session_persistent: true,  sort_order: 1, data_source: 'decks', placeholder: null },
        { field_key: 'title',     label: 'Tiêu đề / Khái niệm',type: 'text',     is_required: true,  is_session_persistent: false, sort_order: 2, data_source: null,    placeholder: 'Nhập tiêu đề...' },
        { field_key: 'content',   label: 'Nội dung',           type: 'textarea', is_required: true,  is_session_persistent: false, sort_order: 3, data_source: null,    placeholder: 'Nội dung chi tiết...' },
        { field_key: 'tags',      label: 'Tags',               type: 'tags',     is_required: false, is_session_persistent: false, sort_order: 4, data_source: null,    placeholder: 'Thêm tag...' },
      ],
    },
  ];

  for (const ct of contentTypes) {
    await seedDoc('content_types', ct.id, {
      code: ct.code,
      name: ct.name,
      description: ct.description,
      icon: ct.icon,
      fields: ct.fields,
      is_active: true,
      sort_order: ct.sort_order,
      created_at: now,
      updated_at: now,
    });
  }
}

// ─── 6. SETTINGS ─────────────────────────────────────────
async function seedSettings() {
  console.log('\n⚙️  Seeding settings...');

  await seedDoc('settings', 'default', {
    unsplash_enabled: true,
    tts_enabled: true,
    ai_model: 'claude-haiku-4-5',
    web_search_enabled: false,
    anki_connect_url: 'http://localhost:8765',
    allow_duplicate: false,
    auto_audio: true,
    auto_image: true,
    updated_at: now,
  });
}

// ─── MAIN ─────────────────────────────────────────────────
async function main() {
  console.log('🚀 Bắt đầu seed dữ liệu vào Firestore...');
  console.log(`   Project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);

  await seedCategories();
  await seedCardTypes();
  await seedTopics();
  await seedDecks();
  await seedContentTypes();
  await seedSettings();

  console.log('\n✨ Seed hoàn tất!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
