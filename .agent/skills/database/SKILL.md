---
name: database
description: >
  Tra cứu hoặc cập nhật cấu trúc database Firestore của ankiflow.
  Dùng khi: user đề cập @database, hỏi về collection/field nào đó,
  viết code query Firestore, thêm field mới vào collection,
  hỏi về enum values (form_type, status...), hoặc thiết kế data model mới.
  KHÔNG tự thay đổi schema mà không có user xác nhận.
---

# Skill: Database

## Mục tiêu
Mọi code liên quan đến Firestore đều phải khớp với schema trong `docs/DATABASE.md`
— đúng tên field, đúng type, đúng enum values.

---

## Bước 1 — Đọc context bắt buộc
Đọc `docs/DATABASE.md` trước khi:
- Viết bất kỳ Firestore query nào
- Tạo hoặc sửa TypeScript interface/type cho data
- Thêm field mới vào collection

---

## Bước 2 — Quick Reference (enum values quan trọng)

### `form_type`
```
form_general   → Từ vựng tổng quát
form_it        → Từ vựng IT / Công nghệ
form_language  → Từ vựng ngôn ngữ (Anh, Trung, Nhật)
```

### `status` (entries collection)
```
draft     → Đang soạn
ready     → Sẵn sàng export Anki
exported  → Đã export vào Anki
archived  → Đã ẩn / không dùng
```

---

## Bước 3 — Viết Firestore query chuẩn

### Pattern cơ bản (Next.js + Firebase SDK):
```typescript
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// List với filter
const q = query(
  collection(db, 'entries'),
  where('form_type', '==', 'form_language'),
  where('status', '==', 'ready'),
  orderBy('created_at', 'desc')
)
const snapshot = await getDocs(q)
const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
```

### Batch fetch quan hệ (không có JOIN):
```typescript
// Fetch entries + resolve categories
const entries = await getDocs(collection(db, 'entries'))
const categoryIds = [...new Set(entries.docs.map(d => d.data().category_id))]
const categories = await Promise.all(
  categoryIds.map(id => getDoc(doc(db, 'categories', id)))
)
```

---

## Bước 4 — Thêm field mới vào collection

Quy trình bắt buộc:
1. Xác định field thuộc collection nào
2. Xác định type và có optional không
3. Kiểm tra có ảnh hưởng đến query hiện tại không (index Firestore)
4. Tạo proposal:

```
📋 SCHEMA CHANGE PROPOSAL
==========================
Collection: entries
Thêm field: sync_status (string, optional)
Enum values: pending | syncing | synced | failed
Lý do: track trạng thái sync với AnkiConnect

Ảnh hưởng:
- Cần update TypeScript interface Entry
- Cần Firestore index nếu query theo field này
```

5. Chờ user confirm → update `docs/DATABASE.md`

---

## Bước 5 — TypeScript interface chuẩn

```typescript
// types/database.ts

export type FormType = 'form_general' | 'form_it' | 'form_language'
export type EntryStatus = 'draft' | 'ready' | 'exported' | 'archived'

export interface Entry {
  id: string
  category_id: string
  form_type: FormType
  language: string
  word: string
  meaning_vi: string
  status: EntryStatus
  created_at: Timestamp
  updated_at: Timestamp
  // language-specific fields optional
  pinyin?: string
  han_viet?: string
  hiragana?: string
  katakana?: string
  romaji?: string
  ipa?: string
  // IT vocab specific
  keywords?: string[]
  topic_ids?: string[]
  difficulty?: string
}
```

---

## Quy tắc bắt buộc
- **KHÔNG** hardcode string cho `form_type` và `status` — phải dùng TypeScript type
- **KHÔNG** thêm field vào Firestore document mà không update `docs/DATABASE.md`
- **KHÔNG** xóa field nếu chưa confirm field đó không còn được dùng
- **PHẢI** dùng `Promise.all()` khi batch fetch — không gọi Firestore trong vòng lặp
- Nếu query cần index mới → cảnh báo user trước khi deploy