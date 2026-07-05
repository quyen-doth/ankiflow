/**
 * scripts/seed-firestore.ts
 * Seed dữ liệu vào Firestore (multi-user era).
 *
 * Cách chạy:
 *   npm run seed                  → seed phần DÙNG CHUNG: content_types (3 form
 *                                   blueprint — doc id = form_type routing) +
 *                                   settings/default (system config của chủ app)
 *   npm run seed -- --user <UID>  → seed thêm bộ master data default PER-USER
 *                                   (categories/card_types/topics/decks + settings/{uid})
 *                                   — thường không cần: signup route tự seed.
 *
 * Idempotent: chạy nhiều lần không bị lỗi, bỏ qua document đã tồn tại.
 * Data default per-user nằm ở lib/seed-defaults.ts (dùng chung với signup route).
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { seedUserDefaults } from '../lib/seed-defaults';

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

// ─── CONTENT TYPES (SHARED — doc id = form_type routing) ──────────
async function seedContentTypes() {
    console.log('\n📋 Seeding content_types (shared)...');

    const contentTypes = [
        {
            id: 'form_language',
            code: 'language',
            name: 'Ngôn ngữ',
            description: 'Từ vựng tiếng Anh, Trung, Nhật',
            icon: '🌍',
            sort_order: 1,
            default_create_mode: 'batch' as const,
            fields: [
                { field_key: 'language', label: 'Ngôn ngữ', type: 'dropdown', is_required: true, is_session_persistent: true, sort_order: 1, data_source: null, placeholder: null },
                { field_key: 'anki_deck', label: 'Anki Deck', type: 'dropdown', is_required: true, is_session_persistent: true, sort_order: 2, data_source: 'decks', placeholder: null },
                { field_key: 'category_id', label: 'Category', type: 'dropdown', is_required: false, is_session_persistent: true, sort_order: 3, data_source: 'categories', placeholder: null },
                { field_key: 'tags', label: 'Tags', type: 'tags', is_required: false, is_session_persistent: true, sort_order: 4, data_source: null, placeholder: 'Thêm tag...' },
                { field_key: 'word', label: 'Từ vựng', type: 'text', is_required: true, is_session_persistent: false, sort_order: 5, data_source: null, placeholder: 'Nhập từ vựng...' },
                { field_key: 'note', label: 'Ghi chú', type: 'text', is_required: false, is_session_persistent: false, sort_order: 6, data_source: null, placeholder: 'Ghi chú cá nhân (optional)' },
                { field_key: 'card_type_ids', label: 'Loại card', type: 'checkbox_group', is_required: false, is_session_persistent: true, sort_order: 7, data_source: 'card_types', placeholder: null },
            ],
        },
        {
            id: 'form_it',
            code: 'it',
            name: 'IT Vocabulary',
            description: 'Thuật ngữ lập trình, công nghệ',
            icon: '💻',
            sort_order: 2,
            default_create_mode: 'single' as const,
            fields: [
                { field_key: 'anki_deck', label: 'Anki Deck', type: 'dropdown', is_required: true, is_session_persistent: true, sort_order: 1, data_source: 'decks', placeholder: null },
                { field_key: 'topic_ids', label: 'Chủ đề', type: 'checkbox_group', is_required: false, is_session_persistent: true, sort_order: 2, data_source: 'topics', placeholder: null },
                { field_key: 'difficulty', label: 'Độ khó', type: 'dropdown', is_required: false, is_session_persistent: true, sort_order: 3, data_source: null, placeholder: null },
                { field_key: 'term', label: 'Thuật ngữ', type: 'text', is_required: true, is_session_persistent: false, sort_order: 4, data_source: null, placeholder: 'Ví dụ: REST API, Docker...' },
                { field_key: 'definition', label: 'Định nghĩa ngắn', type: 'text', is_required: true, is_session_persistent: false, sort_order: 5, data_source: null, placeholder: 'Mô tả ngắn gọn bằng tiếng Việt...' },
                { field_key: 'keywords', label: 'Keywords', type: 'tags', is_required: false, is_session_persistent: false, sort_order: 6, data_source: null, placeholder: 'Thêm keyword liên quan...' },
                { field_key: 'card_type_ids', label: 'Loại card', type: 'checkbox_group', is_required: false, is_session_persistent: true, sort_order: 7, data_source: 'card_types', placeholder: null },
            ],
        },
        {
            id: 'form_general',
            code: 'general',
            name: 'Kiến thức chung',
            description: 'Bất kỳ nội dung nào khác',
            icon: '📚',
            sort_order: 3,
            default_create_mode: 'single' as const,
            fields: [
                { field_key: 'anki_deck', label: 'Anki Deck', type: 'dropdown', is_required: true, is_session_persistent: true, sort_order: 1, data_source: 'decks', placeholder: null },
                { field_key: 'title', label: 'Tiêu đề / Khái niệm', type: 'text', is_required: true, is_session_persistent: false, sort_order: 2, data_source: null, placeholder: 'Nhập tiêu đề...' },
                { field_key: 'content', label: 'Nội dung', type: 'textarea', is_required: true, is_session_persistent: false, sort_order: 3, data_source: null, placeholder: 'Nội dung chi tiết...' },
                { field_key: 'tags', label: 'Tags', type: 'tags', is_required: false, is_session_persistent: false, sort_order: 4, data_source: null, placeholder: 'Thêm tag...' },
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
            default_create_mode: ct.default_create_mode,
            created_at: now,
            updated_at: now,
        });
    }
}

// ─── SETTINGS/DEFAULT (SYSTEM CONFIG của chủ app) ─────────────────
async function seedSystemSettings() {
    console.log('\n⚙️  Seeding settings/default (system config)...');

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

    await seedContentTypes();
    await seedSystemSettings();

    // Optional: seed bộ default per-user (thường signup route tự làm)
    const userFlagIdx = process.argv.indexOf('--user');
    const uid = userFlagIdx !== -1 ? process.argv[userFlagIdx + 1] : null;
    if (uid) {
        console.log(`\n👤 Seeding per-user defaults cho uid: ${uid}...`);
        await seedUserDefaults(db, uid);
        console.log('  ✅ Per-user defaults đã seed (idempotent).');
    }

    console.log('\n✨ Seed hoàn tất!');
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
});
