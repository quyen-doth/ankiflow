/**
 * Seeds shared and optional per-user Firestore data for multi-user AnkiFlow.
 *
 * Usage:
 *   npm run seed
 *     Seeds shared content_types (three routing form blueprints), settings/default
 *     (owner-managed LINE secrets), and settings/global (global feature flags).
 *   npm run seed -- --defaults
 *     Publishes editable new-user templates for categories, card_types, topics, and
 *     decks. This is optional because the first signup lazily publishes them.
 *   npm run seed -- --user <UID>
 *     Seeds one user's master data and settings. The signup route normally does this.
 *
 * Existing documents are skipped, so the script is safe to run repeatedly. Per-user
 * defaults are defined in lib/seed-defaults.ts and shared with the signup route.
 */

import { FIREBASE_ADMIN_ENV_NAMES, loadEnv } from './lib/load-env';
loadEnv({ required: FIREBASE_ADMIN_ENV_NAMES });

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { seedUserDefaults, publishTemplateDefaults } from '../lib/seed-defaults';
import { DEFAULT_CONTENT_TYPES } from '../lib/contentTypes';
import { cloneAiOutputProfiles } from '../lib/ai-agent/outputProfiles';
import { GLOBAL_CONTENT_TYPES_COLLECTION, GLOBAL_SETTINGS_DOC_ID } from '../lib/constants';

// Firebase Adminを初期化する。
const app = initializeApp({
    credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
});

const db = getFirestore(app);
const now = Timestamp.now();

// ─── 存在しないドキュメントだけを作成するヘルパー ──────────────
async function seedDoc(collection: string, id: string, data: Record<string, unknown>) {
    const ref = db.collection(collection).doc(id);
    const snap = await ref.get();
    if (snap.exists) {
        console.log(`  ⏭️  ${collection}/${id} — 既に存在するためスキップ`);
        return;
    }
    await ref.set(data);
    console.log(`  ✅ ${collection}/${id} — 作成しました`);
}

// ─── CONTENT TYPES（共有 — ドキュメントIDをform_typeのroutingに使用）──────────
async function seedContentTypes() {
    console.log('\n📋 content_types（共有）をシードしています...');

    for (const ct of DEFAULT_CONTENT_TYPES) {
        await seedDoc(GLOBAL_CONTENT_TYPES_COLLECTION, ct.id, {
            code: ct.code,
            name: ct.name,
            description: ct.description,
            icon: ct.icon,
            fields: ct.fields.map(field => ({ ...field })),
            ...(ct.ai_output_profiles
                ? { ai_output_profiles: cloneAiOutputProfiles(ct.ai_output_profiles) }
                : {}),
            is_active: ct.is_active,
            sort_order: ct.sort_order,
            default_create_mode: ct.default_create_mode,
            created_at: now,
            updated_at: now,
        });
    }
}

// ─── SETTINGS/DEFAULT（アプリ所有者のLINE認証情報）────
async function seedSecretSettings() {
    console.log('\n🔒 settings/default（LINEシークレット）をシードしています...');

    await seedDoc('settings', 'default', {
        notifications_enabled: false,
        updated_at: now,
    });
}

// ─── SETTINGS/GLOBAL（グローバル機能フラグ — control plane）─────
async function seedGlobalConfig() {
    console.log('\n🌐 settings/global（グローバル機能フラグ）をシードしています...');

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
    console.log('🚀 Firestoreへのシードを開始します...');
    console.log(`   プロジェクト: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);

    await seedContentTypes();
    await seedSecretSettings();
    await seedGlobalConfig();

    // 任意: 管理画面の「New-user defaults」で編集するテンプレート既定値を公開する。
    if (process.argv.includes('--defaults')) {
        console.log('\n📐 テンプレート既定値（categories/card_types/topics/decks）を公開しています...');
        await publishTemplateDefaults(db);
        console.log('  ✅ テンプレート既定値を公開しました（冪等）。');
    }

    // 任意: 通常はsignup routeが作成するユーザー別の既定値をシードする。
    const userFlagIdx = process.argv.indexOf('--user');
    const uid = userFlagIdx !== -1 ? process.argv[userFlagIdx + 1] : null;
    if (uid) {
        console.log(`\n👤 UID: ${uid}のユーザー別既定値をシードしています...`);
        await seedUserDefaults(db, uid);
        console.log('  ✅ ユーザー別既定値をシードしました（冪等）。');
    }

    console.log('\n✨ シードが完了しました。');
    process.exit(0);
}

main().catch((err) => {
    console.error('❌ エラー:', err.message);
    process.exit(1);
});
