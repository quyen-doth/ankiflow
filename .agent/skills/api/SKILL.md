---
name: api
description: >
  Tạo hoặc sửa API endpoint trong ankiflow (Next.js route + Fastify).
  Dùng khi: user đề cập @api, thêm endpoint mới, sửa response type,
  thêm validation, hoặc hỏi về API convention đang dùng.
  KHÔNG dùng cho UI hoặc component.
---

# Skill: API Development

## Mục tiêu
Mọi endpoint được tạo/sửa đều nhất quán với `docs/API.md`
— đúng format, đúng error handling, đúng naming convention.

---

## Bước 1 — Đọc context bắt buộc
1. `docs/API.md` — xem toàn bộ endpoint đã có, format response chuẩn, error codes

> Kiểm tra endpoint tương tự đã tồn tại chưa trước khi tạo mới.

---

## Bước 2 — Convention bắt buộc

### Naming:
```
GET    /api/[resource]          ← list
GET    /api/[resource]/[id]     ← single item
POST   /api/[resource]          ← create
PATCH  /api/[resource]/[id]     ← update
DELETE /api/[resource]/[id]     ← delete
```

### Response format chuẩn:
```typescript
// Success
{ data: T, message?: string }

// Success + pagination
{ data: T[], total: number, page: number }

// Error
{ error: string, code: string }
```

### Error codes:
```
400 BAD_REQUEST     ← validation fail
401 UNAUTHORIZED    ← chưa auth
403 FORBIDDEN       ← không có quyền
404 NOT_FOUND       ← resource không tồn tại
500 INTERNAL_ERROR  ← lỗi server
```

---

## Bước 3 — Tạo endpoint (Next.js App Router)

```typescript
// app/api/[resource]/route.ts

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    // logic
    return NextResponse.json({ data: result })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
```

---

## Bước 4 — Checklist trước khi hoàn thành
- [ ] Input validation đã có chưa?
- [ ] Error handling đã cover đủ case chưa?
- [ ] Response type có khớp với format chuẩn không?
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
- **KHÔNG** dùng format response khác với chuẩn đã định
- **PHẢI** có error handling — không để endpoint throw uncaught error