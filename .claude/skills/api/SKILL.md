---
name: api
description: >
  Tạo hoặc sửa API endpoint trong ankiflow (Next.js App Router route handler).
  Dùng khi: user đề cập @api, thêm endpoint mới, sửa response type,
  thêm validation, hoặc hỏi về API convention đang dùng.
  KHÔNG dùng cho UI hoặc component.
---

# Skill: API Development

## Mục tiêu
Mọi endpoint được tạo/sửa đều nhất quán với `docs/API.md`
— đúng format, đúng error handling, đúng naming convention, dùng đúng helper đã có sẵn.

---

## Bước 1 — Đọc context bắt buộc
1. `docs/API.md` — xem toàn bộ endpoint đã có, format response chuẩn, error codes
2. `lib/api-response.ts` — helper response chuẩn (`apiSuccess`, `apiError`, `catchError`)
3. `lib/auth-guard.ts` — `withAuthGuard` wrapper cho route cần auth
4. `lib/validation.ts` — zod schema + `parseBody` helper

> Kiểm tra endpoint tương tự đã tồn tại chưa trước khi tạo mới.
> Đây là Next.js thuần (App Router) — **không có Fastify** trong project này.

---

## Bước 2 — Convention bắt buộc

### Naming:
```
GET    /api/[resource]          ← list
GET    /api/[resource]/[id]     ← single item
POST   /api/[resource]          ← create
PUT    /api/[resource]          ← update (id nằm trong body, không có segment [id])
DELETE /api/[resource]?id=...   ← delete (id qua query param)
```

### Response format chuẩn (theo `lib/api-response.ts` và `docs/API.md`):
```typescript
// Success — apiSuccess(data, status?)
{ ...data }              // ví dụ: { categories: [...] }, { success: true, id: '...' }

// Error — apiError(message, status) hoặc catchError(error)
{ error: string }         // KHÔNG có field "code"
```

### HTTP status codes phổ biến:
```
200 OK                ← thành công
400 Bad Request       ← payload/query thiếu hoặc sai định dạng
401 Unauthorized       ← thiếu/sai x-api-secret
404 Not Found          ← resource không tồn tại
500 Internal Error     ← lỗi server/external service
503 Service Unavailable ← AnkiConnect chưa mở
```

### Auth (bắt buộc kiểm tra trước khi tạo route):
- `/api/anki/*` và `/api/generate` → **public**, không cần auth guard
- `/api/admin/*` và `/api/history/*` → **bắt buộc** wrap handler bằng `withAuthGuard` (check header `x-api-secret` so với env `API_SECRET`)

---

## Bước 3 — Tạo endpoint (Next.js App Router, theo pattern thật của project)

```typescript
// app/api/[resource]/route.ts

import { NextRequest } from 'next/server'
import { withAuthGuard } from '@/lib/auth-guard'
import { getAdminDb } from '@/lib/firebase-admin'
import { apiSuccess, apiError, catchError } from '@/lib/api-response'
import { parseBody, ResourceSchema } from '@/lib/validation'

async function GET_handler(request: NextRequest) {
  try {
    const db = getAdminDb()
    const snapshot = await db.collection('resource').get()
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    return apiSuccess({ items })
  } catch (error) {
    return catchError(error)
  }
}

async function POST_handler(request: NextRequest) {
  try {
    const parsed = parseBody(ResourceSchema, await request.json())
    if (!parsed.ok) return parsed.response

    const db = getAdminDb()
    const docRef = await db.collection('resource').add(parsed.data)
    return apiSuccess({ success: true, id: docRef.id }, 201)
  } catch (error) {
    return catchError(error)
  }
}

// Chỉ wrap withAuthGuard nếu route thuộc /api/admin/* hoặc /api/history/*
export const GET = withAuthGuard(GET_handler)
export const POST = withAuthGuard(POST_handler)
```

---

## Bước 4 — Checklist trước khi hoàn thành
- [ ] Input validation đã dùng `parseBody` + zod schema chưa?
- [ ] Error handling dùng `catchError`/`apiError` (không tự viết `NextResponse.json` thô)?
- [ ] Response shape có khớp `apiSuccess`/`apiError` (không có field `code`) không?
- [ ] Nếu route thuộc `/api/admin/*` hoặc `/api/history/*` → đã wrap `withAuthGuard` chưa?
- [ ] Endpoint mới có conflict với endpoint đã có không?

---

## Bước 5 — Sau khi tạo xong
```
✅ Đã tạo: POST /api/[resource]

💡 Bạn có muốn mình update docs/API.md để đăng ký endpoint này không?
```

---

## Quy tắc bắt buộc
- **KHÔNG** tạo endpoint nếu chưa đọc `docs/API.md`
- **KHÔNG** tự viết lại response/error format — dùng `apiSuccess`/`apiError`/`catchError` từ `lib/api-response.ts`
- **KHÔNG** quên `withAuthGuard` cho route `/api/admin/*` và `/api/history/*`
- **PHẢI** có error handling — không để endpoint throw uncaught error