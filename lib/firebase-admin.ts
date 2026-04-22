// lib/firebase-admin.ts
// Khởi tạo Firebase Admin SDK cho server-side (API Routes)
// Admin SDK bypass Firestore Security Rules — an toàn vì chỉ chạy phía server

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// Singleton — tránh khởi tạo nhiều lần trong Next.js dev mode (hot reload)
let adminApp: App;
let adminDb: Firestore;

function getAdminApp(): App {
  if (!adminApp) {
    if (getApps().length === 0) {
      adminApp = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
          // Thay \\n thành ký tự xuống dòng thật — cần thiết vì env var lưu dạng chuỗi
          privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      adminApp = getApps()[0];
    }
  }
  return adminApp;
}

export function getAdminDb(): Firestore {
  if (!adminDb) {
    adminDb = getFirestore(getAdminApp());
  }
  return adminDb;
}
