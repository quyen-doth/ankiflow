/**
 * scripts/migrate-form-type.ts
 *
 * Migration: cập nhật form_type từ giá trị cũ ('language', 'it', 'general')
 * sang giá trị enum mới ('form_language', 'form_it', 'form_general')
 *
 * Chạy: npx tsx scripts/migrate-form-type.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const app =
    getApps().length === 0
        ? initializeApp({
              credential: cert({
                  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
                  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
                  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
              }),
          })
        : getApps()[0];

const db = getFirestore(app);

const FORM_TYPE_MAP: Record<string, string> = {
    language: 'form_language',
    it: 'form_it',
    general: 'form_general',
};

const COLLECTIONS = ['card_types', 'categories', 'decks', 'topics', 'content_types'];

async function migrate() {
    console.log('🔄 Migrating form_type values...');
    console.log(`   Project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}\n`);

    let totalUpdated = 0;

    for (const collectionName of COLLECTIONS) {
        const snapshot = await db.collection(collectionName).get();
        let updated = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const oldValue = data.form_type;

            if (oldValue && FORM_TYPE_MAP[oldValue]) {
                const newValue = FORM_TYPE_MAP[oldValue];
                await doc.ref.update({ form_type: newValue });
                console.log(`  ✅ ${collectionName}/${doc.id}: '${oldValue}' → '${newValue}'`);
                updated++;
            } else if (oldValue && Object.values(FORM_TYPE_MAP).includes(oldValue)) {
                console.log(`  ⏭️  ${collectionName}/${doc.id}: already '${oldValue}'`);
            } else if (oldValue) {
                console.log(`  ⚠️  ${collectionName}/${doc.id}: unknown form_type '${oldValue}'`);
            }
        }

        console.log(`  ${collectionName}: ${updated}/${snapshot.size} updated\n`);
        totalUpdated += updated;
    }

    console.log(`✨ Migration complete. ${totalUpdated} documents updated.`);
}

migrate()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('❌ Error:', err.message);
        process.exit(1);
    });
