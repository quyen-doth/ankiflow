/**
 * scripts/seed-firestore.ts
 * Seed dữ liệu vào Firestore (multi-user era).
 *
 * Cách chạy:
 *   npm run seed                    → seed phần DÙNG CHUNG: content_types (3 form
 *                                     blueprint — doc id = form_type routing),
 *                                     settings/default (LINE secrets, admin điền tay),
 *                                     settings/global (feature flags toàn cục)
 *   npm run seed -- --defaults      → publish template defaults (categories/card_types/
 *                                     topics/decks) admin sửa được qua /admin
 *                                     ("New-user defaults") — KHÔNG bắt buộc: user đầu
 *                                     tiên đăng ký sẽ tự lazy-publish nếu chưa có.
 *   npm run seed -- --user <UID>    → seed thêm bộ master data default PER-USER
 *                                     (categories/card_types/topics/decks + settings/{uid})
 *                                     — thường không cần: signup route tự seed.
 *
 * Idempotent: chạy nhiều lần không bị lỗi, bỏ qua document đã tồn tại.
 * Data default per-user nằm ở lib/seed-defaults.ts (dùng chung với signup route).
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { seedUserDefaults, publishTemplateDefaults } from '../lib/seed-defaults';
import { DEFAULT_CONTENT_TYPES } from '../lib/contentTypes';
import { GLOBAL_CONTENT_TYPES_COLLECTION, GLOBAL_SETTINGS_DOC_ID } from '../lib/constants';

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

    for (const ct of DEFAULT_CONTENT_TYPES) {
        await seedDoc(GLOBAL_CONTENT_TYPES_COLLECTION, ct.id, {
            code: ct.code,
            name: ct.name,
            description: ct.description,
            icon: ct.icon,
            fields: ct.fields.map(field => ({ ...field })),
            ...(ct.ai_output_profiles
                ? {
                    ai_output_profiles: ct.ai_output_profiles.map(profile => ({
                        profile: profile.profile,
                        fields: profile.fields.map(field => ({ ...field })),
                    })),
                }
                : {}),
            is_active: ct.is_active,
            sort_order: ct.sort_order,
            default_create_mode: ct.default_create_mode,
            created_at: now,
            updated_at: now,
        });
    }
}

// ─── SETTINGS/DEFAULT (secrets của chủ app — LINE credentials) ────
async function seedSecretSettings() {
    console.log('\n🔒 Seeding settings/default (LINE secrets — điền tay qua /settings)...');

    await seedDoc('settings', 'default', {
        notifications_enabled: false,
        updated_at: now,
    });
}

// ─── SETTINGS/GLOBAL (feature flags toàn cục — control plane) ─────
async function seedGlobalConfig() {
    console.log('\n🌐 Seeding settings/global (feature flags toàn cục)...');

    await seedDoc('settings', GLOBAL_SETTINGS_DOC_ID, {
        ai_model: 'claude-haiku-4-5',
        web_search_enabled: false,
        tts_available: true,
        unsplash_available: true,
        updated_at: now,
    });
}

// ─── MAIN ─────────────────────────────────────────────────
async function main() {
    console.log('🚀 Bắt đầu seed dữ liệu vào Firestore...');
    console.log(`   Project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);

    await seedContentTypes();
    await seedSecretSettings();
    await seedGlobalConfig();

    // Optional: publish template defaults (admin sửa qua /admin → "New-user defaults")
    if (process.argv.includes('--defaults')) {
        console.log('\n📐 Publishing template defaults (categories/card_types/topics/decks)...');
        await publishTemplateDefaults(db);
        console.log('  ✅ Template defaults đã publish (idempotent).');
    }

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
