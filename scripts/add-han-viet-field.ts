/**
 * 既存の LANGUAGE カードタイプテンプレートへ`han_viet`を冪等に追加する。
 *
 * `reading`の直後に挿入し、`reading`がない場合は`word`の直後に挿入する。
 * いずれかの基準フィールドを含む面だけを変更し、entries、settings、decks、
 * categories、およびその他のコレクションは変更しない。entries 用の漢越音
 * コンテンツは生成せず、表示スロットだけを追加する。
 *
 * 実行: npx tsx scripts/add-han-viet-field.ts
 */

import { FIREBASE_ADMIN_ENV_NAMES, loadEnv } from './lib/load-env';
loadEnv({ required: FIREBASE_ADMIN_ENV_NAMES });

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

/** `han_viet`を`reading`優先、なければ`word`の直後に挿入し、変更有無を返す。 */
function withHanViet(side: string[]): { next: string[]; changed: boolean } {
    if (!Array.isArray(side)) return { next: side, changed: false };
    if (side.includes('han_viet')) return { next: side, changed: false };

    const anchor = side.lastIndexOf('reading') !== -1 ? side.lastIndexOf('reading') : side.lastIndexOf('word');
    if (anchor === -1) return { next: side, changed: false }; // word/readingがないsideは変更しない。

    const next = [...side];
    next.splice(anchor + 1, 0, 'han_viet');
    return { next, changed: true };
}

async function run() {
    console.log('🔧 language用card_typesにhan_vietフィールドを追加します...\n');

    const snap = await db.collection('card_types').where('form_type', '==', 'form_language').get();

    if (snap.empty) {
        console.log('  ⚠️  language用card_typesが見つかりません。');
        process.exit(0);
    }

    let updated = 0;
    for (const doc of snap.docs) {
        const data = doc.data() as { template?: { front?: string[]; back?: string[] }; name?: string };
        const template = data.template;
        if (!template) {
            console.log(`  ⏭️  ${doc.id} — テンプレートがないためスキップ`);
            continue;
        }

        const front = withHanViet(template.front ?? []);
        const back = withHanViet(template.back ?? []);

        if (!front.changed && !back.changed) {
            console.log(`  ✓  ${doc.id} — han_vietが既に存在するかword/readingがないためスキップ`);
            continue;
        }

        await doc.ref.update({ template: { front: front.next, back: back.next } });
        updated++;
        console.log(
            `  ✅ ${doc.id} ("${data.name ?? ''}") — front:[${front.next.join(',')}] back:[${back.next.join(',')}]`,
        );
    }

    console.log(`\n完了しました。card_typeを${updated}件更新しました。`);
    process.exit(0);
}

run().catch((err) => {
    console.error('エラー:', err);
    process.exit(1);
});
