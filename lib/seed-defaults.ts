/**
 * デフォルトマスターデータ + ユーザーごとの seeding — SERVER-ONLY (Admin SDK)。
 * 使用元: app/api/auth/signup (新規ユーザーの seed)、scripts/seed-firestore.ts、
 * scripts/migrate-user-data.ts。
 *
 * ユーザーごとの ID スキーム: `${defaultId}__${uid}` — FK re-mapping (decks →
 * default_card_type_ids/default_category_id) は単なる文字列連結、seeding は
 * idempotent (ID の存在チェック)、デバッグしやすい (ID を見れば元 + 所有者が分かる)。
 *
 * TEMPLATE (editable defaults — admin control plane): `seedUserDefaults` は優先的に
 * `user_id == DEFAULTS_OWNER_ID` の docs (テンプレート、admin が /admin の
 * "New-user defaults" モードで編集 — CategoryManager/CardTypeManager/TopicManager/
 * DeckManager を prop `ownerId` でそのまま再利用) を読み込む。テンプレートがない場合
 * (初回、未 publish) → 下にある hardcode 配列 `DEFAULT_*` にフォールバック。
 * `publishTemplateDefaults()` は初回に hardcode をテンプレートとして書き込む
 * (id はサフィックスなし — hardcode の id と同一)。
 *
 * 注記: `content_types` はユーザーごとではない — その doc ID (form_language/form_it/
 * form_general) はアプリ全体のルーティングが依存する `form_type` の値そのもの。
 * content_types をユーザーごとにするには `code` を doc id から分離する必要がある (backlog)。
 */
import type { Firestore } from 'firebase-admin/firestore';
import { DEFAULTS_OWNER_ID } from '@/lib/constants';
import { DEFAULT_STUDY_LANGUAGES } from '@/lib/studyLanguages';
import { FormType } from '@/types';

// ─── デフォルトデータ (出典: scripts/seed-firestore.ts オリジナル) ─────────────────────

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

/** settings/{uid} 用のデフォルト preferences — システムフィールド (ai_model...) は含まない。 */
export const DEFAULT_USER_PREFS = {
    unsplash_enabled: true,
    tts_enabled: true,
    anki_connect_url: 'http://localhost:8765',
    allow_duplicate: false,
    auto_audio: true,
    auto_image: true,
    study_languages: DEFAULT_STUDY_LANGUAGES.map(language => ({ ...language })),
} as const;

// ─── ユーザーごとの seeding ─────────────────────────────────────────────────────────

/** default ID からユーザーごとの ID を生成: `cat_daily` + uid `abc` → `cat_daily__abc`。 */
export const userScopedId = (defaultId: string, uid: string) => `${defaultId}__${uid}`;

async function seedDocIfMissing(db: Firestore, collection: string, id: string, data: Record<string, unknown>) {
    const ref = db.collection(collection).doc(id);
    const snap = await ref.get();
    if (snap.exists) return;
    await ref.set(data);
}

interface TemplateDoc {
    id: string;
    data: FirebaseFirestore.DocumentData;
}

/** 1 つの collection のテンプレート docs (`user_id == DEFAULTS_OWNER_ID`) を読み込む — 未 publish なら空。 */
async function fetchTemplates(db: Firestore, collection: string): Promise<TemplateDoc[]> {
    const snap = await db.collection(collection).where('user_id', '==', DEFAULTS_OWNER_ID).get();
    return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
}

/**
 * hardcode の `DEFAULT_*` 一式をテンプレートとして publish (`user_id: DEFAULTS_OWNER_ID`、
 * id はサフィックスなし — hardcode の id と同一) し、admin が /admin ("New-user defaults")
 * 経由で編集できるようにする。Idempotent — 未存在の doc のみ作成。
 * `scripts/seed-firestore.ts --defaults` から呼び出すか、`seedUserDefaults` 内で
 * テンプレートが一つもない場合の lazy-init として呼ばれる。
 */
export async function publishTemplateDefaults(db: Firestore): Promise<void> {
    const now = new Date();
    await Promise.all([
        ...DEFAULT_CATEGORIES.map((cat) =>
            seedDocIfMissing(db, 'categories', cat.id, {
                user_id: DEFAULTS_OWNER_ID,
                name: cat.name,
                form_type: 'form_language',
                sort_order: cat.sort_order,
                is_active: true,
                created_at: now,
                updated_at: now,
            }),
        ),
        ...DEFAULT_CARD_TYPES.map((ct) =>
            seedDocIfMissing(db, 'card_types', ct.id, {
                user_id: DEFAULTS_OWNER_ID,
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
            seedDocIfMissing(db, 'topics', topic.id, {
                user_id: DEFAULTS_OWNER_ID,
                name: topic.name,
                form_type: 'form_it',
                is_active: true,
                sort_order: topic.sort_order,
                created_at: now,
            }),
        ),
        ...DEFAULT_DECKS.map((deck) =>
            seedDocIfMissing(db, 'decks', deck.id, {
                user_id: DEFAULTS_OWNER_ID,
                anki_deck_name: deck.anki_deck_name,
                display_name: deck.display_name,
                form_type: deck.form_type,
                language: deck.language,
                default_card_type_ids: [...deck.default_card_type_ids],
                default_category_id: deck.default_category_id,
                is_active: true,
                sort_order: deck.sort_order,
                created_at: now,
            }),
        ),
    ]);
}

interface CategorySourceItem {
    id: string; name: string; form_type: string; sort_order: number; is_active: boolean;
}
interface CardTypeSourceItem {
    id: string; code: string; name: string; description: string; form_type: string;
    language: string | null; is_default: boolean; is_active: boolean; sort_order: number;
    template: Record<string, unknown>;
}
interface TopicSourceItem {
    id: string; name: string; form_type: string; is_active: boolean; sort_order: number;
}
interface DeckSourceItem {
    id: string; anki_deck_name: string; display_name: string; form_type: string;
    language: string | null; default_card_type_ids: string[]; default_category_id: string | null;
    is_active: boolean; sort_order: number;
}

/**
 * 新規ユーザー 1 人分のマスターデータを seed (idempotent — doc が既に存在すればスキップ)。
 * 優先的に TEMPLATE (`user_id == DEFAULTS_OWNER_ID`、admin が /admin 経由で編集済み) から
 * クローンする; もしテンプレートが一つも publish されていない場合 (この機能デプロイ後の初回) →
 * hardcode `DEFAULT_*` から lazy-publish してその結果をそのまま使う (最初のユーザーが
 * 1 回だけ "コストを払う"、以降の全ユーザーは自動的にテンプレートの恩恵を受ける —
 * admin はすぐに /admin から編集可能)。
 * decks 内の FK (default_card_type_ids、default_category_id) は `userScopedId` で
 * ユーザーごとの ID に re-map される。
 */
export async function seedUserDefaults(db: Firestore, uid: string): Promise<void> {
    const now = new Date();

    let [catTemplates, ctTemplates, topicTemplates, deckTemplates] = await Promise.all([
        fetchTemplates(db, 'categories'),
        fetchTemplates(db, 'card_types'),
        fetchTemplates(db, 'topics'),
        fetchTemplates(db, 'decks'),
    ]);

    // テンプレートが一つも publish されていない — hardcode から lazy publish して読み直す。
    if (catTemplates.length === 0 && ctTemplates.length === 0 && topicTemplates.length === 0 && deckTemplates.length === 0) {
        await publishTemplateDefaults(db);
        [catTemplates, ctTemplates, topicTemplates, deckTemplates] = await Promise.all([
            fetchTemplates(db, 'categories'),
            fetchTemplates(db, 'card_types'),
            fetchTemplates(db, 'topics'),
            fetchTemplates(db, 'decks'),
        ]);
    }

    const categorySource: CategorySourceItem[] = catTemplates.length > 0
        ? catTemplates.map((t) => ({
            id: t.id,
            name: t.data.name as string,
            form_type: (t.data.form_type as string) ?? FormType.LANGUAGE,
            sort_order: (t.data.sort_order as number) ?? 0,
            is_active: t.data.is_active !== false,
        }))
        : DEFAULT_CATEGORIES.map((cat) => ({ ...cat, form_type: FormType.LANGUAGE, is_active: true }));

    const cardTypeSource: CardTypeSourceItem[] = ctTemplates.length > 0
        ? ctTemplates.map((t) => ({
            id: t.id,
            code: t.data.code as string,
            name: t.data.name as string,
            description: (t.data.description as string) ?? '',
            form_type: t.data.form_type as string,
            language: (t.data.language as string | null) ?? null,
            is_default: !!t.data.is_default,
            is_active: t.data.is_active !== false,
            sort_order: (t.data.sort_order as number) ?? 0,
            template: t.data.template as Record<string, unknown>,
        }))
        : DEFAULT_CARD_TYPES.map((ct) => ({
            ...ct,
            description: '',
            is_active: true,
            template: ct.template as Record<string, unknown>,
        }));

    const topicSource: TopicSourceItem[] = topicTemplates.length > 0
        ? topicTemplates.map((t) => ({
            id: t.id,
            name: t.data.name as string,
            form_type: (t.data.form_type as string) ?? FormType.IT,
            is_active: t.data.is_active !== false,
            sort_order: (t.data.sort_order as number) ?? 0,
        }))
        : DEFAULT_TOPICS.map((topic) => ({ ...topic, form_type: FormType.IT, is_active: true }));

    const deckSource: DeckSourceItem[] = deckTemplates.length > 0
        ? deckTemplates.map((t) => ({
            id: t.id,
            anki_deck_name: t.data.anki_deck_name as string,
            display_name: t.data.display_name as string,
            form_type: t.data.form_type as string,
            language: (t.data.language as string | null) ?? null,
            default_card_type_ids: (t.data.default_card_type_ids as string[]) ?? [],
            default_category_id: (t.data.default_category_id as string | null) ?? null,
            is_active: t.data.is_active !== false,
            sort_order: (t.data.sort_order as number) ?? 0,
        }))
        : DEFAULT_DECKS.map((deck) => ({
            ...deck,
            default_card_type_ids: [...deck.default_card_type_ids],
            is_active: true,
        }));

    await Promise.all([
        ...categorySource.map((cat) =>
            seedDocIfMissing(db, 'categories', userScopedId(cat.id, uid), {
                user_id: uid,
                name: cat.name,
                form_type: cat.form_type,
                sort_order: cat.sort_order,
                is_active: cat.is_active,
                created_at: now,
                updated_at: now,
            }),
        ),
        ...cardTypeSource.map((ct) =>
            seedDocIfMissing(db, 'card_types', userScopedId(ct.id, uid), {
                user_id: uid,
                code: ct.code,
                name: ct.name,
                description: ct.description,
                form_type: ct.form_type,
                language: ct.language,
                is_default: ct.is_default,
                is_active: ct.is_active,
                sort_order: ct.sort_order,
                template: ct.template,
                created_at: now,
            }),
        ),
        ...topicSource.map((topic) =>
            seedDocIfMissing(db, 'topics', userScopedId(topic.id, uid), {
                user_id: uid,
                name: topic.name,
                form_type: topic.form_type,
                is_active: topic.is_active,
                sort_order: topic.sort_order,
                created_at: now,
            }),
        ),
        ...deckSource.map((deck) =>
            seedDocIfMissing(db, 'decks', userScopedId(deck.id, uid), {
                user_id: uid,
                anki_deck_name: deck.anki_deck_name,
                display_name: deck.display_name,
                form_type: deck.form_type,
                language: deck.language,
                // FK re-map: この user 自身のユーザーごとの card_types/categories を指す
                default_card_type_ids: deck.default_card_type_ids.map((id) => userScopedId(id, uid)),
                default_category_id: deck.default_category_id ? userScopedId(deck.default_category_id, uid) : null,
                is_active: deck.is_active,
                sort_order: deck.sort_order,
                created_at: now,
            }),
        ),
        seedDocIfMissing(db, 'settings', uid, { ...DEFAULT_USER_PREFS, updated_at: now }),
    ]);
}
