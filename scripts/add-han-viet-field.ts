/**
 * scripts/add-han-viet-field.ts
 * Idempotent migration: chèn field 'han_viet' vào template của các card_types LANGUAGE
 * (form_type === 'form_language') đang có trong Firestore, ngay sau 'reading' (hoặc 'word'
 * nếu side không có 'reading'). Chỉ đụng những side đã chứa 'word'/'reading'.
 *
 * KHÔNG đụng entries, settings, decks, categories hay collection khác.
 * KHÔNG sinh nội dung han_viet cho entries — chỉ thêm chỗ hiển thị trên mặt thẻ.
 *
 * Chạy: npx tsx scripts/add-han-viet-field.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

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

/** Chèn 'han_viet' sau 'reading' (ưu tiên) hoặc 'word'. Trả về mảng mới + có thay đổi hay không. */
function withHanViet(side: string[]): { next: string[]; changed: boolean } {
  if (!Array.isArray(side)) return { next: side, changed: false };
  if (side.includes('han_viet')) return { next: side, changed: false };

  const anchor = side.lastIndexOf('reading') !== -1 ? side.lastIndexOf('reading') : side.lastIndexOf('word');
  if (anchor === -1) return { next: side, changed: false }; // side không có word/reading → bỏ qua

  const next = [...side];
  next.splice(anchor + 1, 0, 'han_viet');
  return { next, changed: true };
}

async function run() {
  console.log('🔧 Adding han_viet field to language card_types...\n');

  const snap = await db.collection('card_types').where('form_type', '==', 'form_language').get();

  if (snap.empty) {
    console.log('  ⚠️  No language card_types found.');
    process.exit(0);
  }

  let updated = 0;
  for (const doc of snap.docs) {
    const data = doc.data() as { template?: { front?: string[]; back?: string[] }; name?: string };
    const template = data.template;
    if (!template) {
      console.log(`  ⏭️  ${doc.id} — no template, skipping`);
      continue;
    }

    const front = withHanViet(template.front ?? []);
    const back = withHanViet(template.back ?? []);

    if (!front.changed && !back.changed) {
      console.log(`  ✓  ${doc.id} — already has han_viet (or no word/reading), skipping`);
      continue;
    }

    await doc.ref.update({ template: { front: front.next, back: back.next } });
    updated++;
    console.log(`  ✅ ${doc.id} ("${data.name ?? ''}") — front:[${front.next.join(',')}] back:[${back.next.join(',')}]`);
  }

  console.log(`\nDone. ${updated} card_type(s) updated.`);
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
