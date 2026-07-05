/**
 * Default master data + seeding per-user — SERVER-ONLY (Admin SDK).
 * Dùng bởi: app/api/auth/signup (seed cho user mới), scripts/seed-firestore.ts,
 * scripts/migrate-user-data.ts.
 *
 * ID scheme per-user: `${defaultId}__${uid}` — FK re-mapping (decks →
 * default_card_type_ids/default_category_id) chỉ là phép nối chuỗi, seeding
 * idempotent (check tồn tại theo ID), debug dễ (nhìn ID biết gốc + chủ sở hữu).
 *
 * LƯU Ý: `content_types` KHÔNG per-user — doc ID của nó (form_language/form_it/
 * form_general) chính là giá trị `form_type` mà routing toàn app phụ thuộc.
 * Per-user hóa content_types cần tách `code` khỏi doc id (backlog).
 */
import type { Firestore } from 'firebase-admin/firestore';

// ─── Default data (nguồn: scripts/seed-firestore.ts gốc) ─────────────────────

export const DEFAULT_CATEGORIES = [
    { id: 'cat_daily', name: 'Daily', sort_order: 1 },
    { id: 'cat_business', name: 'Business', sort_order: 2 },
    { id: 'cat_travel', name: 'Travel', sort_order: 3 },
    { id: 'cat_food', name: 'Cuisine', sort_order: 4 },
    { id: 'cat_tech', name: 'Technologies', sort_order: 5 },
    { id: 'cat_edu', name: 'Education', sort_order: 6 },
    { id: 'cat_health', name: 'Medicine', sort_order: 7 },
    { id: 'cat_culture', name: 'Culture', sort_order: 8 },
    { id: 'cat_nature', name: 'Nature', sort_order: 9 },
    { id: 'cat_emotion', name: 'Emotion', sort_order: 10 },
] as const;

const T = {
    word_to_meaning: { front: ['word', 'reading', 'han_viet'], back: ['meaning', 'word_type', 'image', 'audio'] },
    meaning_to_word: { front: ['meaning'], back: ['word', 'reading', 'han_viet', 'audio'] },
    audio_to_word: { front: ['audio'], back: ['word', 'reading', 'han_viet', 'meaning'] },
    image_to_word: { front: ['image'], back: ['word', 'reading', 'han_viet', 'meaning', 'audio'] },
    fill_in_blank: { front: ['example_blank'], back: ['example', 'translation', 'word', 'audio'] },
    reading_to_word: { front: ['reading'], back: ['word', 'han_viet', 'meaning', 'audio'] },
    word_to_reading: { front: ['word', 'han_viet'], back: ['reading', 'meaning', 'audio'] },
    concept_to_def: { front: ['word'], back: ['meaning', 'example', 'translation', 'audio'] },
    def_to_concept: { front: ['meaning'], back: ['word', 'example', 'audio'] },
    front_to_back: { front: ['word'], back: ['meaning', 'example', 'translation', 'audio'] },
} as const;

export const DEFAULT_CARD_TYPES = [
    {
        id: 'ct_word_meaning',
        code: 'word_to_meaning',
        name: 'Word → Meaning',
        form_type: 'form_language',
        language: null,
        is_default: true,
        sort_order: 1,
        template: T.word_to_meaning,
    },
    {
        id: 'ct_meaning_word',
        code: 'meaning_to_word',
        name: 'Meaning → Word',
        form_type: 'form_language',
        language: null,
        is_default: true,
        sort_order: 2,
        template: T.meaning_to_word,
    },
    {
        id: 'ct_audio_word',
        code: 'audio_to_word',
        name: 'Audio → Word',
        form_type: 'form_language',
        language: null,
        is_default: true,
        sort_order: 3,
        template: T.audio_to_word,
    },
    {
        id: 'ct_image_word',
        code: 'image_to_word',
        name: 'Image → Word',
        form_type: 'form_language',
        language: null,
        is_default: true,
        sort_order: 4,
        template: T.image_to_word,
    },
    {
        id: 'ct_fill_blank',
        code: 'fill_in_blank',
        name: 'Fill in the Blank',
        form_type: 'form_language',
        language: null,
        is_default: true,
        sort_order: 5,
        template: T.fill_in_blank,
    },
    {
        id: 'ct_pinyin_char',
        code: 'reading_to_word',
        name: 'Pinyin → Character',
        form_type: 'form_language',
        language: 'zh',
        is_default: false,
        sort_order: 6,
        template: T.reading_to_word,
    },
    {
        id: 'ct_char_pinyin',
        code: 'word_to_reading',
        name: 'Character → Pinyin',
        form_type: 'form_language',
        language: 'zh',
        is_default: false,
        sort_order: 7,
        template: T.word_to_reading,
    },
    {
        id: 'ct_hira_kanji',
        code: 'reading_to_word',
        name: 'Hiragana → Kanji',
        form_type: 'form_language',
        language: 'ja',
        is_default: false,
        sort_order: 6,
        template: T.reading_to_word,
    },
    {
        id: 'ct_kanji_hira',
        code: 'word_to_reading',
        name: 'Kanji → Hiragana',
        form_type: 'form_language',
        language: 'ja',
        is_default: false,
        sort_order: 7,
        template: T.word_to_reading,
    },
    {
        id: 'ct_concept_def',
        code: 'concept_to_def',
        name: 'Concept → Definition',
        form_type: 'form_it',
        language: null,
        is_default: true,
        sort_order: 1,
        template: T.concept_to_def,
    },
    {
        id: 'ct_def_concept',
        code: 'def_to_concept',
        name: 'Definition → Concept',
        form_type: 'form_it',
        language: null,
        is_default: true,
        sort_order: 2,
        template: T.def_to_concept,
    },
    {
        id: 'ct_front_back',
        code: 'front_to_back',
        name: 'Front → Back',
        form_type: 'form_general',
        language: null,
        is_default: true,
        sort_order: 1,
        template: T.front_to_back,
    },
] as const;

export const DEFAULT_TOPICS = [
    { id: 'topic_db', name: 'Database', sort_order: 1 },
    { id: 'topic_fe', name: 'Frontend', sort_order: 2 },
    { id: 'topic_be', name: 'Backend', sort_order: 3 },
    { id: 'topic_algo', name: 'Algorithm', sort_order: 4 },
    { id: 'topic_devops', name: 'DevOps', sort_order: 5 },
    { id: 'topic_sec', name: 'Security', sort_order: 6 },
    { id: 'topic_arch', name: 'Architecture', sort_order: 7 },
    { id: 'topic_net', name: 'Network', sort_order: 8 },
    { id: 'topic_os', name: 'OS', sort_order: 9 },
    { id: 'topic_ds', name: 'Data Science', sort_order: 10 },
    { id: 'topic_mobile', name: 'Mobile', sort_order: 11 },
    { id: 'topic_ai', name: 'AI / ML', sort_order: 12 },
] as const;

const FULL_LANG_SET = ['ct_word_meaning', 'ct_meaning_word', 'ct_audio_word', 'ct_image_word', 'ct_fill_blank'];
const CORE_LANG_SET = ['ct_word_meaning', 'ct_meaning_word', 'ct_audio_word', 'ct_fill_blank'];

export const DEFAULT_DECKS = [
    {
        id: 'deck_zh_hsk1',
        anki_deck_name: 'Language::Chinese::HSK1',
        display_name: 'Chinese HSK1',
        form_type: 'form_language',
        language: 'chinese',
        default_card_type_ids: FULL_LANG_SET,
        default_category_id: 'cat_daily',
        sort_order: 1,
    },
    {
        id: 'deck_zh_hsk2',
        anki_deck_name: 'Language::Chinese::HSK2',
        display_name: 'Chinese HSK2',
        form_type: 'form_language',
        language: 'chinese',
        default_card_type_ids: FULL_LANG_SET,
        default_category_id: 'cat_daily',
        sort_order: 2,
    },
    {
        id: 'deck_zh_hsk3',
        anki_deck_name: 'Language::Chinese::HSK3',
        display_name: 'Chinese HSK3',
        form_type: 'form_language',
        language: 'chinese',
        default_card_type_ids: CORE_LANG_SET,
        default_category_id: 'cat_daily',
        sort_order: 3,
    },
    {
        id: 'deck_ja_n5',
        anki_deck_name: 'Language::Japanese::N5',
        display_name: 'Japanese N5',
        form_type: 'form_language',
        language: 'japanese',
        default_card_type_ids: FULL_LANG_SET,
        default_category_id: 'cat_daily',
        sort_order: 4,
    },
    {
        id: 'deck_ja_n4',
        anki_deck_name: 'Language::Japanese::N4',
        display_name: 'Japanese N4',
        form_type: 'form_language',
        language: 'japanese',
        default_card_type_ids: CORE_LANG_SET,
        default_category_id: 'cat_daily',
        sort_order: 5,
    },
    {
        id: 'deck_en_b1',
        anki_deck_name: 'Language::English::B1',
        display_name: 'English B1',
        form_type: 'form_language',
        language: 'english',
        default_card_type_ids: FULL_LANG_SET,
        default_category_id: 'cat_daily',
        sort_order: 6,
    },
    {
        id: 'deck_en_b2',
        anki_deck_name: 'Language::English::B2',
        display_name: 'English B2',
        form_type: 'form_language',
        language: 'english',
        default_card_type_ids: CORE_LANG_SET,
        default_category_id: 'cat_daily',
        sort_order: 7,
    },
    {
        id: 'deck_it',
        anki_deck_name: 'Vocabulary::IT',
        display_name: 'IT Vocabulary',
        form_type: 'form_it',
        language: null,
        default_card_type_ids: ['ct_concept_def', 'ct_def_concept'],
        default_category_id: null,
        sort_order: 8,
    },
    {
        id: 'deck_general',
        anki_deck_name: 'Vocabulary::General',
        display_name: 'General Knowledge',
        form_type: 'form_general',
        language: null,
        default_card_type_ids: ['ct_front_back'],
        default_category_id: null,
        sort_order: 9,
    },
] as const;

/** Preferences mặc định cho settings/{uid} — KHÔNG chứa system fields (ai_model...). */
export const DEFAULT_USER_PREFS = {
    unsplash_enabled: true,
    tts_enabled: true,
    anki_connect_url: 'http://localhost:8765',
    allow_duplicate: false,
    auto_audio: true,
    auto_image: true,
} as const;

// ─── Per-user seeding ─────────────────────────────────────────────────────────

/** ID per-user từ default ID: `cat_daily` + uid `abc` → `cat_daily__abc`. */
export const userScopedId = (defaultId: string, uid: string) => `${defaultId}__${uid}`;

/**
 * Seed bộ master data default cho 1 user mới (idempotent — doc tồn tại thì bỏ qua).
 * FK trong decks (default_card_type_ids, default_category_id) được re-map sang
 * ID per-user bằng cùng quy tắc `userScopedId`.
 */
export async function seedUserDefaults(db: Firestore, uid: string): Promise<void> {
    const now = new Date();

    const seedDoc = async (collection: string, id: string, data: Record<string, unknown>) => {
        const ref = db.collection(collection).doc(id);
        const snap = await ref.get();
        if (snap.exists) return;
        await ref.set(data);
    };

    await Promise.all([
        ...DEFAULT_CATEGORIES.map((cat) =>
            seedDoc('categories', userScopedId(cat.id, uid), {
                user_id: uid,
                name: cat.name,
                form_type: 'form_language',
                sort_order: cat.sort_order,
                is_active: true,
                created_at: now,
                updated_at: now,
            }),
        ),
        ...DEFAULT_CARD_TYPES.map((ct) =>
            seedDoc('card_types', userScopedId(ct.id, uid), {
                user_id: uid,
                code: ct.code,
                name: ct.name,
                description: '',
                form_type: ct.form_type,
                language: ct.language,
                is_default: ct.is_default,
                is_active: true,
                sort_order: ct.sort_order,
                template: ct.template,
                created_at: now,
            }),
        ),
        ...DEFAULT_TOPICS.map((topic) =>
            seedDoc('topics', userScopedId(topic.id, uid), {
                user_id: uid,
                name: topic.name,
                form_type: 'form_it',
                is_active: true,
                sort_order: topic.sort_order,
                created_at: now,
            }),
        ),
        ...DEFAULT_DECKS.map((deck) =>
            seedDoc('decks', userScopedId(deck.id, uid), {
                user_id: uid,
                anki_deck_name: deck.anki_deck_name,
                display_name: deck.display_name,
                form_type: deck.form_type,
                language: deck.language,
                // FK re-map: trỏ sang card_types/categories per-user của CHÍNH user này
                default_card_type_ids: deck.default_card_type_ids.map((id) => userScopedId(id, uid)),
                default_category_id: deck.default_category_id ? userScopedId(deck.default_category_id, uid) : null,
                is_active: true,
                sort_order: deck.sort_order,
                created_at: now,
            }),
        ),
        seedDoc('settings', uid, { ...DEFAULT_USER_PREFS, updated_at: now }),
    ]);
}
