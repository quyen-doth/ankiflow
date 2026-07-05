/**
 * scripts/fix-card-types.ts
 * Targeted migration: cập nhật tên + template cho card_types trong Firestore live.
 * KHÔNG đụng entries, settings, decks, categories hay bất kỳ collection nào khác.
 *
 * Chạy: npx tsx scripts/fix-card-types.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app = initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
});

const db = getFirestore(app);

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

// Chỉ update name + form_type (nếu sai) + template — giữ nguyên id/code/language/is_default/is_active/sort_order
const UPDATES: Record<string, { name: string; form_type?: string; template: (typeof T)[keyof typeof T] }> = {
    ct_word_meaning: { name: 'Word → Meaning', template: T.word_to_meaning },
    ct_meaning_word: { name: 'Meaning → Word', template: T.meaning_to_word },
    ct_audio_word: { name: 'Audio → Word', template: T.audio_to_word },
    ct_image_word: { name: 'Image → Word', template: T.image_to_word },
    ct_fill_blank: { name: 'Fill in the Blank', form_type: 'form_language', template: T.fill_in_blank },
    ct_pinyin_char: { name: 'Pinyin → Character', template: T.reading_to_word },
    ct_char_pinyin: { name: 'Character → Pinyin', template: T.word_to_reading },
    ct_hira_kanji: { name: 'Hiragana → Kanji', template: T.reading_to_word },
    ct_kanji_hira: { name: 'Kanji → Hiragana', template: T.word_to_reading },
    ct_concept_def: { name: 'Concept → Definition', template: T.concept_to_def },
    ct_def_concept: { name: 'Definition → Concept', template: T.def_to_concept },
    ct_front_back: { name: 'Front → Back', template: T.front_to_back },
};

async function run() {
    console.log('🔧 Updating card_types in Firestore...\n');

    for (const [id, patch] of Object.entries(UPDATES)) {
        const ref = db.collection('card_types').doc(id);
        const snap = await ref.get();

        if (!snap.exists) {
            console.log(`  ⚠️  ${id} — not found, skipping`);
            continue;
        }

        const update: Record<string, unknown> = {
            name: patch.name,
            template: patch.template,
        };
        if (patch.form_type) update.form_type = patch.form_type;

        await ref.update(update);
        console.log(`  ✅ ${id} — updated (name: "${patch.name}")`);
    }

    console.log('\nDone.');
    process.exit(0);
}

run().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
});
