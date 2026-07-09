---
name: init
description: >
  Khởi tạo feature mới hoặc module mới trong project ankiflow.
  Dùng khi: user đề cập @init, bắt đầu build một tính năng mới,
  cần tạo cấu trúc file/folder chuẩn, hoặc hỏi "bắt đầu từ đâu".
  KHÔNG dùng cho việc sửa code đã có sẵn.
---

# Skill: Init Feature

## Mục tiêu
Khởi tạo feature mới đúng convention của ankiflow — cấu trúc nhất quán,
đọc đúng docs trước khi tạo file, không đoán mò architecture.

---

## Bước 1 — Đọc context bắt buộc
Trước khi tạo bất kỳ file nào, đọc:
1. `docs/prd.md` — hiểu scope và business logic
2. `docs/tasks.md` — xác định task đang làm là gì, status hiện tại
3. `docs/design/DESIGN.md` — nếu feature có UI
4. `docs/API.md` — nếu feature có API endpoint mới

---

## Bước 2 — Hỏi trước khi tạo
Xác nhận với user:
> "Feature này thuộc layer nào: UI component, API route, hay cả hai?"

---

## Bước 3 — Tạo cấu trúc chuẩn

### Nếu là UI feature (Next.js App Router):
```
app/
└── [feature-name]/
    ├── page.tsx          ← route chính
    ├── layout.tsx        ← nếu cần layout riêng
    └── components/       ← component local của feature
        └── [Component].tsx

components/                  ← nếu component dùng chung
└── [category]/              ← ví dụ: create/, preview/, admin/, ui/
    └── [Component].tsx      ← file phẳng, KHÔNG tạo folder riêng + index.tsx
```

### Nếu là API route (Next.js App Router — không có Fastify trong project này):
```
app/
└── api/
    └── [feature-name]/
        └── route.ts      ← Next.js route handler, dùng helper trong lib/api-response.ts, lib/auth-guard.ts
```
> Xem skill `api` để biết chi tiết convention (response format, auth guard, validation).

### Naming convention:
- Folder: `kebab-case`
- Component file: `PascalCase.tsx`
- API route: `route.ts` (Next.js convention)
- Utility/helper: `camelCase.ts`

---

## Bước 4 — Tạo file với boilerplate tối thiểu
Chỉ tạo skeleton — KHÔNG viết business logic chưa được confirm:

```tsx
// page.tsx boilerplate
export default function [FeatureName]Page() {
  return <div>[FeatureName]</div>
}
```

---

## Bước 5 — Báo cáo & đề xuất update tasks
Sau khi tạo xong:
```
✅ Đã khởi tạo: [feature-name]
Files tạo mới:
- app/[feature-name]/page.tsx
- app/[feature-name]/components/...

💡 Bạn có muốn mình update docs/tasks.md để đánh dấu task này đang In Progress không?
```

---

## Quy tắc bắt buộc
- **KHÔNG** tạo file nếu chưa đọc `docs/prd.md` và `docs/tasks.md`
- **KHÔNG** tạo quá những gì cần thiết cho bước hiện tại
- **PHẢI** hỏi nếu feature name hoặc scope chưa rõ