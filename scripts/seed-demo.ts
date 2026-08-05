/**
 * scripts/seed-demo.ts
 * Seed a curated, neutral demo dataset into the REAL Firestore project, scoped to
 * the demo account's own isolated workspace (per-user isolation). Used only to
 * produce portfolio screenshots — never touches other users' data.
 *
 * Prerequisites (in `.env` / `.env.local`):
 *   FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY
 *   DEMO_EMAIL   — the demo account email (its Auth user must already exist)
 *
 * Usage:
 *   npm run seed:demo            → seed master defaults (idempotent) + demo entries
 *   npm run seed:demo -- --clean → delete ONLY the demo entries created by this script
 *
 * Idempotent: every entry uses a deterministic document ID (`demo__<uid>__<slug>`),
 * so re-running overwrites in place instead of creating duplicates. Timestamps are
 * fixed (not `now`) so repeated runs and screenshots stay stable.
 */

import { FIREBASE_ADMIN_ENV_NAMES, loadEnv } from './lib/load-env';
loadEnv({ required: FIREBASE_ADMIN_ENV_NAMES });
if (!process.env.DEMO_EMAIL?.trim()) {
    throw new Error('Missing required environment variable: DEMO_EMAIL');
}

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { seedUserDefaults, userScopedId } from '../lib/seed-defaults';
import { deriveEntryQueryMetadata } from '../lib/entries/queryMetadata';
import { FormType } from '../types';

const app = initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
});

const db = getFirestore(app);
const auth = getAuth(app);

/** Fixed timestamps so the dataset — and the screenshots — are deterministic. */
const day = (iso: string) => Timestamp.fromDate(new Date(`${iso}T09:00:00Z`));

/** Which content family an entry belongs to; resolved to a real deck + card types at runtime. */
type DeckKey = 'zh' | 'ja' | 'en' | 'it' | 'general';

const FORM_OF: Record<DeckKey, FormType> = {
    zh: FormType.LANGUAGE,
    ja: FormType.LANGUAGE,
    en: FormType.LANGUAGE,
    it: FormType.IT,
    general: FormType.GENERAL,
};
const LANG_OF: Partial<Record<DeckKey, string>> = { zh: 'zh', ja: 'ja', en: 'en' };

/** Deterministic doc id for a general deck this script creates when the account has none. */
const GENERAL_DECK_ID = (uid: string) => `demo__${uid}__deck_general`;

interface DemoEntry {
    slug: string;
    deck: DeckKey;
    status: 'draft' | 'reviewed' | 'synced';
    created: string; // ISO date
    fields: Record<string, unknown>;
    ankiNoteIds?: number[];
}

/** Neutral, non-personal vocabulary — nothing from the user's real study set. */
const DEMO_ENTRIES: DemoEntry[] = [
    // ─── Chinese (zh) ───────────────────────────────────
    {
        slug: 'zh-library', deck: 'zh', status: 'synced', created: '2026-07-18',
        ankiNoteIds: [1720000001, 1720000002],
        fields: {
            word: '图书馆', pinyin: 'túshūguǎn', han_viet: 'Đồ thư quán',
            meaning_vi: 'library', word_type: 'noun', level: 'HSK3',
            example_sentence: '我每天在图书馆学习。', example_translation: 'I study at the library every day.',
            collocations: ['公共图书馆', '图书馆管理员'],
        },
    },
    {
        slug: 'zh-environment', deck: 'zh', status: 'reviewed', created: '2026-07-22',
        fields: {
            word: '环境', pinyin: 'huánjìng', han_viet: 'Hoàn cảnh',
            meaning_vi: 'environment', word_type: 'noun', level: 'HSK4',
            example_sentence: '保护环境是每个人的责任。', example_translation: 'Protecting the environment is everyone\'s responsibility.',
            collocations: ['自然环境', '工作环境'],
        },
    },
    {
        slug: 'zh-economy', deck: 'zh', status: 'reviewed', created: '2026-07-25',
        fields: {
            word: '经济', pinyin: 'jīngjì', han_viet: 'Kinh tế',
            meaning_vi: 'economy', word_type: 'noun', level: 'HSK4',
            example_sentence: '这个国家的经济发展很快。', example_translation: 'This country\'s economy is developing quickly.',
            collocations: ['市场经济', '经济增长'],
        },
    },
    // ─── Japanese (ja) ──────────────────────────────────
    {
        slug: 'ja-library', deck: 'ja', status: 'synced', created: '2026-07-19',
        ankiNoteIds: [1720000010],
        fields: {
            word: '図書館', hiragana: 'としょかん', romaji: 'toshokan',
            meaning_vi: 'library', word_type: 'noun', level: 'N5',
            example_sentence: '図書館で本を借りました。', example_translation: 'I borrowed a book at the library.',
            collocations: ['図書館に行く', '市立図書館'],
        },
    },
    {
        slug: 'ja-promise', deck: 'ja', status: 'reviewed', created: '2026-07-24',
        fields: {
            word: '約束', hiragana: 'やくそく', romaji: 'yakusoku',
            meaning_vi: 'promise', word_type: 'noun', level: 'N4',
            example_sentence: '友達と会う約束をしました。', example_translation: 'I made a promise to meet a friend.',
            collocations: ['約束を守る', '約束の時間'],
        },
    },
    // ─── English (en) ───────────────────────────────────
    {
        slug: 'en-resilience', deck: 'en', status: 'synced', created: '2026-07-20',
        ankiNoteIds: [1720000020],
        fields: {
            word: 'resilience', ipa: '/rɪˈzɪl.jəns/',
            meaning_vi: 'the capacity to recover quickly from difficulties', word_type: 'noun', level: 'B2',
            example_sentence: 'Her resilience helped her overcome every setback.',
            collocations: ['emotional resilience', 'build resilience'],
        },
    },
    {
        slug: 'en-meticulous', deck: 'en', status: 'reviewed', created: '2026-07-27',
        fields: {
            word: 'meticulous', ipa: '/məˈtɪk.jə.ləs/',
            meaning_vi: 'showing great attention to detail; very careful', word_type: 'adjective', level: 'C1',
            example_sentence: 'He kept meticulous records of every experiment.',
            collocations: ['meticulous planning', 'meticulous attention'],
        },
    },
    {
        slug: 'en-spontaneous', deck: 'en', status: 'draft', created: '2026-07-30',
        fields: {
            word: 'spontaneous', ipa: '/spɒnˈteɪ.ni.əs/',
            word_type: 'adjective', level: 'B2',
        },
    },
    // ─── IT vocabulary (form_it) ────────────────────────
    {
        slug: 'it-idempotency', deck: 'it', status: 'synced', created: '2026-07-21',
        ankiNoteIds: [1720000030],
        fields: {
            term: 'Idempotency',
            definition: 'A property where an operation produces the same result no matter how many times it is applied.',
            meaning_vi: 'An operation safe to repeat without changing the outcome beyond the first call.',
            keywords: ['REST', 'retry', 'HTTP PUT'], topics: ['topic_be'], difficulty: 'medium',
            example_sentence: 'PUT requests should be idempotent so retries never create duplicates.',
        },
    },
    {
        slug: 'it-load-balancer', deck: 'it', status: 'reviewed', created: '2026-07-26',
        fields: {
            term: 'Load Balancer',
            definition: 'A component that distributes incoming network traffic across multiple servers.',
            meaning_vi: 'Spreads requests across servers to improve availability and throughput.',
            keywords: ['round-robin', 'health check', 'reverse proxy'], topics: ['topic_arch', 'topic_net'], difficulty: 'easy',
            example_sentence: 'The load balancer routes users to the least busy instance.',
        },
    },
    {
        slug: 'it-race-condition', deck: 'it', status: 'reviewed', created: '2026-07-28',
        fields: {
            term: 'Race Condition',
            definition: 'A flaw where the result depends on the unpredictable timing of concurrent operations.',
            meaning_vi: 'A bug that appears when two tasks access shared state without proper ordering.',
            keywords: ['concurrency', 'mutex', 'atomic'], topics: ['topic_be', 'topic_algo'], difficulty: 'hard',
            example_sentence: 'A missing lock introduced a race condition on the counter.',
        },
    },
    // ─── General knowledge (form_general) ───────────────
    {
        slug: 'gen-photosynthesis', deck: 'general', status: 'synced', created: '2026-07-23',
        ankiNoteIds: [1720000040],
        fields: {
            title: 'Photosynthesis',
            content: 'The process by which green plants convert light energy, water, and carbon dioxide into glucose and oxygen.',
            meaning_vi: 'How plants turn sunlight into chemical energy, releasing oxygen.',
        },
    },
    {
        slug: 'gen-compound-interest', deck: 'general', status: 'reviewed', created: '2026-07-29',
        fields: {
            title: 'Compound Interest',
            content: 'Interest calculated on both the initial principal and the accumulated interest from previous periods.',
            meaning_vi: 'Interest that earns interest, making savings grow faster over time.',
        },
    },
];

interface DeckRef {
    anki_deck: string;
    card_type_ids: string[];
}

interface DeckDoc { form_type?: string; language?: string | null; anki_deck_name?: string }
interface CardTypeDoc { form_type?: string; language?: string | null; is_active?: boolean }

/**
 * Resolve a real deck name + valid card type IDs for every DeckKey from the account's
 * ACTUAL master data (admin may have renamed/removed the hardcoded defaults). If the
 * account has no General deck, create a deterministic one so General entries can render.
 */
async function buildDeckRefs(uid: string): Promise<Record<DeckKey, DeckRef>> {
    const [deckSnap, ctSnap] = await Promise.all([
        db.collection('decks').where('user_id', '==', uid).get(),
        db.collection('card_types').where('user_id', '==', uid).where('is_active', '==', true).get(),
    ]);
    const decks = deckSnap.docs.map(d => ({ id: d.id, ...(d.data() as DeckDoc) }));
    const cts = ctSnap.docs.map(d => ({ id: d.id, ...(d.data() as CardTypeDoc) }));

    // Card types valid for a form + language: language-agnostic (null) plus language-specific.
    const cardTypesFor = (form: FormType, lang?: string): string[] =>
        cts.filter(c => c.form_type === form && (c.language == null || c.language === lang))
            .map(c => c.id)
            .sort((a, b) => a.localeCompare(b))
            .slice(0, 3);

    // Pick a deck name deterministically; for language forms also match the language.
    const deckNameFor = (form: FormType, lang?: string): string | undefined =>
        decks.filter(d => d.form_type === form && (form !== FormType.LANGUAGE || d.language === lang))
            .map(d => d.anki_deck_name)
            .filter((n): n is string => typeof n === 'string' && n.length > 0)
            .sort((a, b) => a.localeCompare(b))[0];

    // Ensure a General deck exists (the account has none by default).
    let generalDeckName = deckNameFor(FormType.GENERAL);
    if (!generalDeckName) {
        generalDeckName = 'Vocabulary::General';
        await db.collection('decks').doc(GENERAL_DECK_ID(uid)).set({
            user_id: uid,
            anki_deck_name: generalDeckName,
            display_name: 'General Knowledge',
            form_type: FormType.GENERAL,
            language: null,
            default_card_type_ids: cardTypesFor(FormType.GENERAL),
            default_category_id: null,
            is_active: true,
            sort_order: 99,
            created_at: day('2026-07-15'),
            updated_at: day('2026-07-15'),
        });
        console.log(`  ➕ Created a General deck (${GENERAL_DECK_ID(uid)}) — account had none.`);
    }

    const refFor = (key: DeckKey): DeckRef => {
        const form = FORM_OF[key];
        const lang = LANG_OF[key];
        const name = key === 'general' ? generalDeckName! : deckNameFor(form, lang);
        const cardTypeIds = cardTypesFor(form, lang);
        if (!name) throw new Error(`No ${form} deck (lang=${lang ?? '—'}) found for the demo account`);
        if (cardTypeIds.length === 0) throw new Error(`No active ${form} card types (lang=${lang ?? '—'}) found`);
        return { anki_deck: name, card_type_ids: cardTypeIds };
    };

    return { zh: refFor('zh'), ja: refFor('ja'), en: refFor('en'), it: refFor('it'), general: refFor('general') };
}

/** Map an entry's language-specific fields to its language + output_language + category/topic scoping. */
function scopeExtras(uid: string, entry: DemoEntry): Record<string, unknown> {
    const out: Record<string, unknown> = { output_language: 'en' };
    if (entry.deck === 'zh') out.language = 'zh';
    if (entry.deck === 'ja') out.language = 'ja';
    if (entry.deck === 'en') out.language = 'en';

    const fields = { ...entry.fields };
    // Re-scope topic ids to the user's copies (topic_be → topic_be__<uid>).
    if (Array.isArray(fields.topics)) {
        out.topic_ids = (fields.topics as string[]).map(id => userScopedId(id, uid));
        delete fields.topics;
    }
    // Language entries belong to the Daily category; IT/General use topics/none.
    if (entry.deck === 'zh' || entry.deck === 'ja' || entry.deck === 'en') {
        out.category_id = userScopedId('cat_daily', uid);
    } else {
        out.category_id = null;
    }
    return { ...fields, ...out };
}

function docId(uid: string, slug: string): string {
    return `demo__${uid}__${slug}`;
}

async function seedEntries(uid: string): Promise<void> {
    console.log('\n📝 Seeding demo entries...');
    // Resolve every deck once from real master data (no Firestore call inside the entry loop).
    const deckRefs = await buildDeckRefs(uid);

    await Promise.all(DEMO_ENTRIES.map(async entry => {
        const deckRef = deckRefs[entry.deck];
        const created = day(entry.created);
        const base: Record<string, unknown> = {
            user_id: uid,
            form_type: entry.deck === 'it'
                ? FormType.IT
                : entry.deck === 'general'
                    ? FormType.GENERAL
                    : FormType.LANGUAGE,
            status: entry.status,
            anki_deck: deckRef.anki_deck,
            card_type_ids: deckRef.card_type_ids,
            tags: [],
            anki_note_ids: entry.ankiNoteIds ?? [],
            created_at: created,
            updated_at: created,
            ...scopeExtras(uid, entry),
        };
        await db.collection('entries').doc(docId(uid, entry.slug)).set({
            ...base,
            ...deriveEntryQueryMetadata(base),
        });
    }));
    console.log(`  ✅ ${DEMO_ENTRIES.length} demo entries seeded (deterministic IDs).`);
}

async function cleanEntries(uid: string): Promise<void> {
    console.log('\n🧹 Removing demo entries created by this script...');
    await Promise.all([
        ...DEMO_ENTRIES.map(entry => db.collection('entries').doc(docId(uid, entry.slug)).delete()),
        // Also remove the General deck this script may have created (id is script-owned).
        db.collection('decks').doc(GENERAL_DECK_ID(uid)).delete(),
    ]);
    console.log(`  ✅ ${DEMO_ENTRIES.length} demo entries + script-created General deck removed. (Other master data untouched.)`);
}

async function main(): Promise<void> {
    const email = process.env.DEMO_EMAIL!.trim();
    console.log('🚀 Demo seed');
    console.log(`   Project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);
    console.log(`   Demo account: ${email}`);

    const user = await auth.getUserByEmail(email).catch(() => {
        throw new Error(`No Auth user for DEMO_EMAIL=${email}. Sign up that account once, then re-run.`);
    });
    const uid = user.uid;
    console.log(`   UID: ${uid}`);

    if (process.argv.includes('--clean')) {
        await cleanEntries(uid);
        console.log('\n✨ Clean complete!');
        process.exit(0);
    }

    console.log('\n📦 Ensuring master defaults (idempotent)...');
    await seedUserDefaults(db, uid);
    console.log('  ✅ Master defaults present.');

    await seedEntries(uid);
    console.log('\n✨ Demo seed complete!');
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
