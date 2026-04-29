# AGENTS.md — AnkiFlow

> File này được đọc bởi AI agent ở mỗi session mới.
> Đây là nguồn thông tin cơ bản về project, convention và quy tắc làm việc.

---

## Project Overview

**AnkiFlow** là web app hỗ trợ tạo và quản lý từ vựng đa ngôn ngữ,
tích hợp trực tiếp với Anki thông qua AnkiConnect.

**Người dùng:** Học ngôn ngữ (Anh, Trung, Nhật) và IT vocabulary.

**Workflow cốt lõi:**
```
Nhập từ vựng → AI bổ sung thông tin → Export sang Anki → Ôn tập
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript (strict mode) |
| Database | Google Firestore (NoSQL) |
| Styling | Tailwind CSS |
| Anki Integration | AnkiConnect (local HTTP API) |
| AI | Gemini API |
| Media | Unsplash API, TTS |

---

## Docs Structure

Toàn bộ tài liệu nằm trong `docs/`. Đây là source of truth — đọc đúng file trước khi làm việc:

| File | Nội dung | Đọc khi |
|---|---|---|
| `docs/prd.md` | Product requirement, scope | Bắt đầu feature mới |
| `docs/tasks.md` | Danh sách task, status | Check việc cần làm |
| `docs/API.md` | Endpoint, request/response format | Viết hoặc gọi API |
| `docs/DATABASE.md` | Firestore schema, enum values | Viết query hoặc thêm field |
| `docs/design/DESIGN.md` | Design system, tokens, spacing | Tạo hoặc sửa UI |
| `docs/design/COMPONENT.md` | Danh sách component đã có | Trước khi tạo component mới |

---

## Skills Available

Dùng các skill sau thay vì tự đoán quy trình:

| Skill | Khi nào dùng |
|---|---|
| `@init` | Bắt đầu feature mới |
| `@design` | Tạo hoặc sửa UI component |
| `@api` | Thêm hoặc sửa API endpoint |
| `@debug` | Có lỗi cần fix |
| `@deploy` | Chuẩn bị deploy |
| `@update-docs` | Sau khi code thay đổi |
| `@database` | Query Firestore hoặc thêm field |

---

## Code Conventions

### TypeScript
- Strict mode bật — không dùng `any`
- Dùng `interface` cho object shape, `type` cho union/intersection
- `import type` cho type-only imports
- Không dùng `default export` cho components — dùng named export

### Next.js App Router
- File route: `app/[feature]/page.tsx`
- API route: `app/api/[resource]/route.ts` — tên file phải là `route.ts`
- Server component là mặc định — chỉ thêm `'use client'` khi cần thiết

### Firestore
- Không gọi Firestore trong vòng lặp — dùng `Promise.all()` để batch fetch
- Không hardcode string cho `form_type` và `status` — dùng TypeScript enum/type
- Xem `docs/DATABASE.md` để biết tên field chính xác và enum values

### Naming
- Folder: `kebab-case`
- Component: `PascalCase.tsx`
- Utility/hook: `camelCase.ts`
- Constant: `UPPER_SNAKE_CASE`

---

## Enum Values Quan Trọng

### `form_type`
```
form_general    Từ vựng tổng quát
form_it         Từ vựng IT / Công nghệ
form_language   Từ vựng ngôn ngữ (Anh, Trung, Nhật)
```

### `status` (entries)
```
draft      Đang soạn
ready      Sẵn sàng export Anki
exported   Đã export vào Anki
archived   Đã ẩn / không dùng
```

---

## Safety Guardrails

Các hành động sau **bắt buộc phải có xác nhận của user trước khi thực hiện:**

- Ghi hoặc xóa document trong Firestore
- Gọi AnkiConnect API (tạo/xóa note trong Anki)
- Deploy lên production
- Xóa file trong codebase
- Update bất kỳ file nào trong `docs/`

> **Nguyên tắc:** Propose trước — apply sau khi user nói "ok" hoặc "apply".

---

## Git Conventions

```
feat:     Tính năng mới
fix:      Bug fix
docs:     Chỉ thay đổi docs
refactor: Refactor, không thêm tính năng
chore:    Config, build, dependencies
```

Ví dụ: `feat: add POST /api/entries endpoint`

---

## Project-Specific Gotchas

- **AnkiConnect chạy local** — chỉ hoạt động khi Anki đang mở trên máy user.
  Mọi call tới AnkiConnect cần có error handling rõ ràng cho trường hợp Anki đóng.

- **Firestore không có JOIN** — khi cần data từ nhiều collection,
  phải batch fetch bằng `Promise.all()`, không fetch tuần tự trong vòng lặp.

- **`form_type` là routing field chính** — nhiều component và query filter theo field này.
  Sai `form_type` → hiển thị sai form, load sai data.

- **Language-specific fields là optional** — `pinyin`, `hiragana`, `ipa`...
  chỉ có giá trị khi `language` tương ứng. Không assume field này luôn có giá trị.

- **`settings` là singleton** — chỉ có 1 document trong collection này.
  Không tạo document mới, chỉ update document đã có.