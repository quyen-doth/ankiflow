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
 * `content_types` は admin が管理する新規ユーザー用 source。新規 account 作成時に
 * `user_content_types` へ snapshot を作り、それ以降は自動同期しない。
 */
import { GrpcStatus, type Firestore } from 'firebase-admin/firestore';
import {
    DEFAULTS_OWNER_ID,
    GLOBAL_CONTENT_TYPES_COLLECTION,
    USER_CONTENT_TYPES_COLLECTION,
} from '@/lib/constants';
import {
    materializeUserContentType,
    parseContentTypeConfig,
    type ContentTypeSourceDocument,
} from '@/lib/contentTypes';
import { DEFAULT_STUDY_LANGUAGES } from '@/lib/studyLanguages';
import { FormType, LanguageType } from '@/types';

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
        language: LanguageType.CHINESE,
        default_card_type_ids: FULL_LANG_SET,
        default_category_id: 'cat_daily',
        sort_order: 1,
    },
    {
        id: 'deck_zh_hsk2',
        anki_deck_name: 'Language::Chinese::HSK2',
        display_name: 'Chinese HSK2',
        form_type: 'form_language',
        language: LanguageType.CHINESE,
        default_card_type_ids: FULL_LANG_SET,
        default_category_id: 'cat_daily',
        sort_order: 2,
    },
    {
        id: 'deck_zh_hsk3',
        anki_deck_name: 'Language::Chinese::HSK3',
        display_name: 'Chinese HSK3',
        form_type: 'form_language',
        language: LanguageType.CHINESE,
        default_card_type_ids: CORE_LANG_SET,
        default_category_id: 'cat_daily',
        sort_order: 3,
    },
    {
        id: 'deck_ja_n5',
        anki_deck_name: 'Language::Japanese::N5',
        display_name: 'Japanese N5',
        form_type: 'form_language',
        language: LanguageType.JAPANESE,
        default_card_type_ids: FULL_LANG_SET,
        default_category_id: 'cat_daily',
        sort_order: 4,
    },
    {
        id: 'deck_ja_n4',
        anki_deck_name: 'Language::Japanese::N4',
        display_name: 'Japanese N4',
        form_type: 'form_language',
        language: LanguageType.JAPANESE,
        default_card_type_ids: CORE_LANG_SET,
        default_category_id: 'cat_daily',
        sort_order: 5,
    },
    {
        id: 'deck_en_b1',
        anki_deck_name: 'Language::English::B1',
        display_name: 'English B1',
        form_type: 'form_language',
        language: LanguageType.ENGLISH,
        default_card_type_ids: FULL_LANG_SET,
        default_category_id: 'cat_daily',
        sort_order: 6,
    },
    {
        id: 'deck_en_b2',
        anki_deck_name: 'Language::English::B2',
        display_name: 'English B2',
        form_type: 'form_language',
        language: LanguageType.ENGLISH,
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

export const USER_DEFAULT_COLLECTIONS = ['categories', 'card_types', 'topics', 'decks'] as const;
export type UserDefaultCollection = (typeof USER_DEFAULT_COLLECTIONS)[number];

export interface UserDefaultTemplateDocument {
    id: string;
    data: Record<string, unknown>;
}

export type UserDefaultTemplateSnapshot = Record<UserDefaultCollection, UserDefaultTemplateDocument[]>;

export interface UserDefaultReferenceIds {
    categoryIds?: ReadonlyMap<string, string>;
    cardTypeIds?: ReadonlyMap<string, string>;
}

export interface MaterializedUserDefaultDocument {
    id: string;
    data: Record<string, unknown>;
}

/**
 * Template 1 件を user-owned document に変換する共通経路。
 * Template の system fields は引き継がず、deck FK は解決済み ID を優先して user scope に変換する。
 */
export function materializeUserDefaultDocument(
    collection: UserDefaultCollection,
    template: UserDefaultTemplateDocument,
    uid: string,
    references: UserDefaultReferenceIds = {},
): MaterializedUserDefaultDocument {
    const data = { ...template.data };
    delete data.user_id;
    delete data.created_at;
    delete data.updated_at;

    if (collection === 'decks') {
        const cardTypeIds = Array.isArray(data.default_card_type_ids)
            ? data.default_card_type_ids.filter((id): id is string => typeof id === 'string')
            : [];
        const categoryId = typeof data.default_category_id === 'string' ? data.default_category_id : null;
        data.default_card_type_ids = cardTypeIds.map((id) =>
            references.cardTypeIds?.get(id) ?? userScopedId(id, uid));
        data.default_category_id = categoryId
            ? references.categoryIds?.get(categoryId) ?? userScopedId(categoryId, uid)
            : null;
    }

    return {
        id: userScopedId(template.id, uid),
        data: { ...data, user_id: uid },
    };
}

async function seedDocIfMissing(db: Firestore, collection: string, id: string, data: Record<string, unknown>) {
    const ref = db.collection(collection).doc(id);
    const snap = await ref.get();
    if (snap.exists) return;
    await ref.set(data);
}

function errorCode(error: unknown): unknown {
    return error && typeof error === 'object' && 'code' in error
        ? (error as { code: unknown }).code
        : undefined;
}

async function createUserContentTypeIfMissing(
    db: Firestore,
    uid: string,
    source: ContentTypeSourceDocument,
    now: Date,
): Promise<void> {
    const snapshot = materializeUserContentType(source, uid);
    try {
        await db.collection(USER_CONTENT_TYPES_COLLECTION).doc(snapshot.id).create({
            ...snapshot.data,
            created_at: now,
            updated_at: now,
        });
    } catch (error) {
        const code = errorCode(error);
        if (code === GrpcStatus.ALREADY_EXISTS || code === 'already-exists') return;
        throw new Error(
            `Failed to seed ${USER_CONTENT_TYPES_COLLECTION} for user ${uid}`,
            { cause: error },
        );
    }
}

/** Global Content Types を一度だけ読み、editable config と source ID に正規化する。 */
async function fetchGlobalContentTypes(db: Firestore): Promise<ContentTypeSourceDocument[]> {
    try {
        const snapshot = await db.collection(GLOBAL_CONTENT_TYPES_COLLECTION).get();
        return snapshot.docs.map((document) => ({
            id: document.id,
            ...parseContentTypeConfig(document.data()),
        }));
    } catch (error) {
        throw new Error(`Failed to load ${GLOBAL_CONTENT_TYPES_COLLECTION} defaults`, { cause: error });
    }
}

/** 1 つの collection のテンプレート docs (`user_id == DEFAULTS_OWNER_ID`) を読み込む — 未 publish なら空。 */
async function fetchTemplates(db: Firestore, collection: UserDefaultCollection): Promise<UserDefaultTemplateDocument[]> {
    const snap = await db.collection(collection).where('user_id', '==', DEFAULTS_OWNER_ID).get();
    return snap.docs.map((d) => ({ id: d.id, data: { ...d.data() } as Record<string, unknown> }));
}

function hardcodedTemplateSnapshot(): UserDefaultTemplateSnapshot {
    return {
        categories: DEFAULT_CATEGORIES.map((category) => ({
            id: category.id,
            data: {
                user_id: DEFAULTS_OWNER_ID,
                name: category.name,
                form_type: FormType.LANGUAGE,
                sort_order: category.sort_order,
                is_active: true,
            },
        })),
        card_types: DEFAULT_CARD_TYPES.map((cardType) => ({
            id: cardType.id,
            data: {
                user_id: DEFAULTS_OWNER_ID,
                code: cardType.code,
                name: cardType.name,
                description: '',
                form_type: cardType.form_type,
                language: cardType.language,
                is_default: cardType.is_default,
                is_active: true,
                sort_order: cardType.sort_order,
                template: cardType.template,
            },
        })),
        topics: DEFAULT_TOPICS.map((topic) => ({
            id: topic.id,
            data: {
                user_id: DEFAULTS_OWNER_ID,
                name: topic.name,
                form_type: FormType.IT,
                is_active: true,
                sort_order: topic.sort_order,
            },
        })),
        decks: DEFAULT_DECKS.map((deck) => ({
            id: deck.id,
            data: {
                user_id: DEFAULTS_OWNER_ID,
                anki_deck_name: deck.anki_deck_name,
                display_name: deck.display_name,
                form_type: deck.form_type,
                language: deck.language,
                default_card_type_ids: [...deck.default_card_type_ids],
                default_category_id: deck.default_category_id,
                is_active: true,
                sort_order: deck.sort_order,
            },
        })),
    };
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
    const templates = hardcodedTemplateSnapshot();
    await Promise.all(
        USER_DEFAULT_COLLECTIONS.flatMap((collection) =>
            templates[collection].map((template) =>
                seedDocIfMissing(db, collection, template.id, {
                    ...template.data,
                    created_at: now,
                    updated_at: now,
                }),
            ),
        ),
    );
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

    const [initialTemplates, globalContentTypes] = await Promise.all([
        Promise.all([
            fetchTemplates(db, 'categories'),
            fetchTemplates(db, 'card_types'),
            fetchTemplates(db, 'topics'),
            fetchTemplates(db, 'decks'),
        ]),
        fetchGlobalContentTypes(db),
    ]);
    let [catTemplates, ctTemplates, topicTemplates, deckTemplates] = initialTemplates;

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

    const hardcodedTemplates = hardcodedTemplateSnapshot();
    const templates: UserDefaultTemplateSnapshot = {
        categories: catTemplates.length > 0 ? catTemplates : hardcodedTemplates.categories,
        card_types: ctTemplates.length > 0 ? ctTemplates : hardcodedTemplates.card_types,
        topics: topicTemplates.length > 0 ? topicTemplates : hardcodedTemplates.topics,
        decks: deckTemplates.length > 0 ? deckTemplates : hardcodedTemplates.decks,
    };

    const userDocuments = USER_DEFAULT_COLLECTIONS.flatMap((collection) =>
        templates[collection].map((template) => ({
            collection,
            ...materializeUserDefaultDocument(collection, template, uid),
        })),
    );

    await Promise.all([
        ...userDocuments.map((document) =>
            seedDocIfMissing(db, document.collection, document.id, {
                ...document.data,
                created_at: now,
                updated_at: now,
            }),
        ),
        ...globalContentTypes.map((contentType) =>
            createUserContentTypeIfMissing(db, uid, contentType, now),
        ),
        seedDocIfMissing(db, 'settings', uid, { ...DEFAULT_USER_PREFS, updated_at: now }),
    ]);
}
