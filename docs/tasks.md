# ✅ Task List — AnkiFlow Project

**Dự án:** AnkiFlow — Personal Flashcard Automation
**Cập nhật lần cuối:** 2026-06-07 (v2.0 — tái cấu trúc toàn bộ sau khi đối chiếu với code thực tế; xem "Ghi chú đối chiếu" cuối file)

---

## 📌 Ghi chú ký hiệu

- `[ ]` Chưa làm
- `[/]` Đang làm
- `[x]` Hoàn thành (đã verify bằng code/file thực tế trong repo)
- `[?]` Không thể verify từ repo — cần tự kiểm tra thủ công (Anki Desktop, Firestore Console...)
- ⚠️ Cần chú ý đặc biệt
- 🔑 Cần API key / credential

---

# PHẦN A — ✅ ĐÃ HOÀN THÀNH (Setup, Backend, UI, Design System)

> Toàn bộ mục này đã được đối chiếu trực tiếp với code/file trong repo (không chỉ dựa vào checklist cũ). Nền tảng kỹ thuật của app đã xong — phần còn lại của dự án là **kiểm thử luồng E2E thực tế với Anki + Firestore** và **tài liệu hoá**, xem Phần B.

## PHASE 0 — Chuẩn bị & Setup

### 0.1 API Keys & Credentials 🔑

- [x] `.env.local` tồn tại và đã điền đủ 14 biến môi trường (Firebase Admin, Firebase Client, Gemini, Google TTS, Unsplash, AnkiConnect, API_SECRET) — verify: `ls -la .env.local` cho thấy file 3.5KB, sửa lần cuối 2026-06-06
- [?] **Tự kiểm tra:** các key có còn hiệu lực / đúng quota không (Gemini, TTS, Unsplash) — không thể verify từ repo

### 0.2 Setup Anki [?]

> Phần này diễn ra hoàn toàn trong Anki Desktop — **không thể verify từ repo**. Tự kiểm tra theo checklist gốc:

- [?] AnkiConnect plugin đã cài (code `2055492159`) và `http://localhost:8765` phản hồi OK
- [?] Cấu trúc Deck đã tạo: `Language::Chinese::HSK1/HSK2`, `Language::Japanese::N5/N4`, `Language::English::B1`, `Vocabulary::IT`, `Vocabulary::General`
- [?] Note Types (Models) đã tạo đủ 5 model với field list đúng (xem chi tiết field trong bản gốc của file này tại commit `e84b36c`, hoặc `docs/prd.md` mục 9)
- [?] Card Templates (Front/Back HTML+CSS) đã setup cho 22 card type (Chinese 7, Japanese 7, English 5, IT 2, General 1)

### 0.3 Setup Project Next.js

- [x] Project Next.js 16 (App Router, TypeScript strict, Tailwind v4) đã khởi tạo và chạy được — verify: `package.json`, `npm run dev` đã chạy nhiều lần trong session refactor
- [x] Dependencies đã cài: `firebase`, `firebase-admin`, `@google/generative-ai`, `@google-cloud/text-to-speech`, `lucide-react`, `clsx`, `tailwind-merge` — verify: import trong `lib/`, `components/ui/utils.ts`
- [x] `lib/firebase.ts` (client SDK) + `lib/firebase-admin.ts` (admin SDK) đã tách riêng đúng quy ước CLAUDE.md
- [x] Cấu trúc thư mục đầy đủ theo `docs/prd.md` — verify: `app/`, `components/`, `lib/`, `hooks/`, `types/`, `docs/` đều tồn tại với nội dung đúng vai trò

### 0.4 Seed Data cho Firestore

- [x] Script `scripts/seed-firestore.ts` tồn tại, chạy qua `npm run seed` (đã khai trong CLAUDE.md mục Commands)
- [?] **Tự kiểm tra:** script đã được CHẠY chưa và Firestore hiện có đủ data mặc định (`categories`, `card_types`, `topics`, `decks`, `content_types`, `settings` singleton) — không thể verify từ repo, cần mở Firestore Console hoặc test trang `/admin`, `/settings`, `/create` (nếu dropdown trống = chưa seed)

---

## PHASE 1 — Backend API Routes — ✅ HOÀN THÀNH TOÀN BỘ

Tất cả route + lib đã tồn tại và đúng kiến trúc trong `docs/API.md` / CLAUDE.md. Verify: `ls app/api/` → `admin, anki, audio, generate, history, image`; `ls lib/` → đủ `gemini.ts`, `tts.ts`, `unsplash.ts`, `session.ts`, `validation.ts`, `auth-guard.ts`, `flashcard-service/`, `prompts/`.

- [x] **1.1 Types** — `types/index.ts`: Entry, Category, CardTypeConfig, Topic, DeckConfig, ContentType, FormFieldConfig, SessionState, enums `FormType`/`LanguageType`
- [x] **1.2 AnkiConnect** — `lib/flashcard-service/` (đã abstract qua provider, xem commit `a93f6e1`), `app/api/anki/connect`, `app/api/anki/decks`, `app/api/anki/create`
- [x] **1.3 Generate (AI)** — `lib/prompts/{chinese,japanese,english,it-vocab}.ts`, `lib/gemini.ts`, `app/api/generate/route.ts`
- [x] **1.4 Audio (TTS)** — `lib/tts.ts`, `lib/audio-service.ts`, `app/api/audio/route.ts`
- [x] **1.5 Images (Unsplash)** — `lib/unsplash.ts`, `app/api/image/route.ts`
- [x] **1.6 History** — `app/api/history/route.ts` (GET list/POST), `app/api/history/[id]/route.ts` (GET/PUT/DELETE)
- [x] **1.7 Admin CRUD** — `app/api/admin/{categories,card-types,topics,decks,content-types}/route.ts`, bảo vệ bởi `lib/auth-guard.ts` (`x-api-secret`)
- [x] **1.8 Session Persistence** — `lib/session.ts`, `hooks/useSession.ts`

> ⚠️ Lưu ý: `lib/validation.ts` và `lib/api-response.ts`, `lib/firestore-helpers.ts`, `lib/constants.ts` cũng đã được thêm (không có trong checklist gốc) — hạ tầng backend rộng hơn kế hoạch ban đầu, đã chuẩn hoá response format + validation Zod.

---

## PHASE 2 — UI Components — ✅ HOÀN THÀNH TOÀN BỘ

> Checklist gốc có nhiều mục trùng lặp (hai mục "2.3") và mô tả props lỗi thời (vd. `StatCard` ghi `unit/trend/trendPositive` nhưng code thực dùng `delta/icon`). Mục này đã viết lại, gộp trùng, và chỉ ghi nhận những gì **thực sự tồn tại trong code**. **Tham chiếu chính xác props/variants tại `docs/design/COMPONENT.md` (đã rewrite theo code hiện tại) — không dùng mô tả trong file này làm spec.**

### 2.0 UI Foundation (`components/ui/`)

- [x] `Button`, `Badge`, `Card`, `Toggle`, `Modal`, `LoadingOverlay`, `StepIndicator`, `ProgressBar`, `DataTable`, `FilterBar`, `AnkiFlowLogo`, `ConnectedBadge`, `FlowTip`, `EmptyState`, `ErrorMessage`, `Tabs`, `StatCard`, `TagInput`, `FormField` (Input/Textarea/Select/FieldWrapper)
- [x] `lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)

### 2.1 Layout & Navigation (`components/layout/`)

- [x] `NavigationSidebar` — đã viết lại thành **responsive** (desktop sidebar tĩnh + mobile drawer trượt + top bar) trong Design Refactor 2026-06, xem Phase 5 bên dưới
- [x] `PageHeader` — breadcrumb `›`, title serif, actions slot
- [x] `app/layout.tsx` — fonts (Newsreader/Nunito Sans), `<html lang="en">`, layout responsive (`md:ml-64`)

### 2.2 Create Page (`app/create/`, `components/create/`)

- [x] `CategorySelector`, `LanguageSelector`, `DeckSelector`, `CardTypeSelector`, `TopicSelector`, `LanguageForm`, `ITForm`, `GeneralForm`, `SectionDivider`, `SmartEnrichmentBanner`, `app/create/page.tsx`
- [x] Luồng 2 bước (chọn loại → điền form), session-persistent fields, reset content fields sau khi tạo, `LoadingOverlay` 3 bước (Gemini → TTS → Unsplash)

### 2.3 Preview Page (`app/preview/`, `components/preview/`)

- [x] `EditableField`, `CollocationEditor`, `ImageSelector`, `AudioPlayer`, `CardPreview`, `CardList`, `app/preview/page.tsx`
- [x] Layout 2 cột (form sửa + live preview dính), `Modal` confirm trước khi export, hooks `usePreviewEntry` + `useAnkiExport`

### 2.4 History (`app/history/`, `components/history/`)

- [x] `HistoryTable` (dùng `DataTable`), `WordDetailCard`, `app/history/page.tsx` (filter + table), `app/history/[id]/page.tsx` 🆕

### 2.5 Admin (`app/admin/`, `components/admin/`) 🆕 — trang mới, build trong Design Refactor

- [x] `app/admin/page.tsx` (5 tab: Categories/Card Types/Topics/Decks/Content Types), `CategoryManager`, `CardTypeManager`, `TopicManager`, `DeckManager`, `ContentTypeManager` — CRUD đầy đủ qua `DataTable` + `Modal` + `/api/admin/*`

### 2.6 Dashboard (`app/dashboard/`) 🆕 — trang mới

- [x] `StatCard`, `app/dashboard/page.tsx` — greeting, stat grid, recent entries, language breakdown, AI suggestion (`FlowTip`), CTA "Create a card"

### 2.7 Settings (`app/settings/`) 🆕 — trang mới

- [x] `app/settings/page.tsx` — integration status, AnkiConnect URL, Gemini model, toggles `unsplash_enabled`/`tts_enabled`
- [x] **Quyết định kiến trúc:** đọc/ghi `settings` qua **Firebase Client SDK trực tiếp** (không qua `/api/admin/*`); `settings` là singleton — chỉ update document hiện có

---

## ✅ PHASE 5 — Design Refactor (hoàn thành 2026-06)

> Phạm vi: toàn bộ UI (trang hiện có + trang mới). Kế hoạch chi tiết: `flashcard/plans/design-refactor-plan-2026-06-07.md`. Không đổi business logic / enum / khóa dữ liệu Firestore.

- [x] **Bước 1 — Design system foundation**: hợp nhất token màu/font/radius/shadow trong `app/globals.css` (`@theme`, Tailwind v4), thêm `--color-on-primary`, `<html lang="en">`
- [x] **Bước 2 — Chuẩn hoá shared UI primitives**: `Button` (thêm size `xl`), `Badge`, `Card`, `StatCard`, `Tabs`, `EmptyState`, `FormField`, `Modal`, `PageHeader`, `FilterBar`, `DataTable` — xoá hardcode `text-gray-*`, `focus:ring-0`, thống nhất `rounded-*` theo phân cấp (full/lg/xl/md)
- [x] **Bước 3 — Refactor trang hiện có**: Create, Preview, History — chuyển toàn bộ copy sang tiếng Anh, áp design system mới
- [x] **Bước 4 — Build trang mới**: Dashboard, History Detail, Settings, Admin (xem 2.4–2.7)
- [x] **Bước 5 — Polish**: a11y (focus-visible ring bắt buộc), responsive mobile, motion tiết chế, dọn dead code
- [x] **Bước 6 — Cập nhật tài liệu**: `docs/design/DESIGN.md` (rewrite v3.0), `docs/design/COMPONENT.md` (rewrite), `docs/tasks.md` (file này), `CLAUDE.md` (bảng Key Directories)

### Phát sinh quan trọng trong quá trình refactor

- [x] **Responsive mobile cho `NavigationSidebar`** — sidebar cố định 256px gây vỡ layout ở viewport 390px (nội dung bị bóp còn ~134px). Viết lại thành: top bar `md:hidden` + drawer trượt + backdrop, đóng drawer khi đổi route bằng pattern "adjust state during render" (không dùng `useEffect`, tránh lint `react-hooks/set-state-in-effect`). Xem `docs/design/COMPONENT.md` mục 5.
- [x] **Thống nhất UI copy 100% tiếng Anh** — quét toàn bộ `app/`, `components/`, `hooks/` bằng regex Unicode tiếng Việt, sửa các chuỗi hiển thị còn sót (`hooks/usePreviewEntry.ts`, `hooks/useAnkiExport.ts`). Giữ nguyên enum/data keys, dữ liệu người dùng nhập, prompt Gemini (`lib/prompts/*.ts`).
- [x] **Sửa `ConnectedBadge` gọi sai endpoint** — `/api/anki/status` (404 lặp mỗi 30s, không tồn tại) → `/api/anki/connect` (endpoint thật).
- [x] **Phát hiện & fix bug collision token `--spacing-*`** — `--spacing-sm: 8px` trong `@theme` đè lên scale của Tailwind khiến `max-w-sm` resolve sai. Đã xoá block `--spacing-*`, ghi "lesson learned" trong `DESIGN.md`.

---

# PHẦN B — 🔲 CÒN LẠI (Integration, Testing, Docs)

> Đây là phần việc thực sự còn mở — nền tảng kỹ thuật & UI đã xong, nhưng **chưa có bằng chứng nào trong repo cho thấy luồng E2E (Create → Generate → Preview → Export sang Anki thật) đã được test thành công**. Đây nên là ưu tiên kế tiếp.

## PHASE 3 — Tích hợp & Luồng hoàn chỉnh (E2E)

### 3.1 State Management — hạ tầng đã đủ, không cần thêm

- [x] ~~React Context / Zustand store~~ — **không cần**: `lib/pendingEntry.ts` (localStorage) + `lib/session.ts` đã đảm nhiệm việc truyền dữ liệu `/create` → `/preview` và session-persistence; thêm store sẽ là over-engineering
- [x] ~~`hooks/useFirestore.ts`~~ — **không cần riêng**: mỗi trang/feature gọi Firestore qua API route hoặc Client SDK trực tiếp tuỳ ngữ cảnh (đã thống nhất trong Settings/Admin), một CRUD-helper chung không khớp với cách Admin dùng `/api/admin/*` (Zod + auth) còn Settings dùng Client SDK
- [ ] `hooks/useAnkiConnection.ts` — hiện `ConnectedBadge` đã tự poll `/api/anki/connect` mỗi 30s nội bộ; nếu cần tái sử dụng logic này ở nơi khác (vd. banner cảnh báo toàn trang khi mất kết nối) thì mới nên tách ra hook riêng — **để mở, chỉ làm khi có use case cụ thể**

### 3.2 Test luồng E2E: Language Card ⚠️ ưu tiên cao nhất

> Yêu cầu: Anki Desktop đang mở + AnkiConnect hoạt động + Firestore đã seed dữ liệu

- [ ] **Chinese flow** (làm trước, đầy đủ field nhất — có Pinyin, Hán Việt, Collocations):
    - Nhập "书" → `/api/generate` trả JSON đúng schema → Preview hiển thị đủ field
    - TTS sinh audio cho từ + câu ví dụ, lưu vào Anki media qua `storeMediaFile`
    - Unsplash trả về ảnh, chọn & gắn vào card
    - Export: tất cả card type đã chọn được tạo đúng trong Anki, Entry log lưu vào Firestore với `status: 'exported'`
    - Quay về `/create`: chỉ field nội dung (Từ vựng, Ghi chú) bị reset, field cấu hình (Deck, Category, Tags, Card Types) giữ nguyên
- [ ] **Japanese flow** — kiểm tra riêng field Hiragana/Katakana/Romaji
- [ ] **English flow** — kiểm tra riêng field IPA + Collocations

### 3.3 Test luồng E2E: IT Vocabulary

- [ ] Nhập "API" + chọn Topics (Backend, Architecture) → Gemini trả JSON có `analogy` → Preview → Export → verify card trong Anki

### 3.4 Test luồng Deck → Form Mapping

- [ ] Chọn deck `Language::Chinese::HSK1` → form tự chuyển sang Language + ngôn ngữ Chinese (đọc từ `DeckConfig.form_type`/`language`)
- [ ] Test với ít nhất 1 deck mỗi `form_type` (Language, IT, General) để đảm bảo auto-detect đúng cho cả 3

### 3.5 Error Handling — verify hành vi thực tế khi lỗi xảy ra

- [ ] Anki Desktop đóng → `ConnectedBadge` hiện "Anki offline", export hiện thông báo lỗi rõ ràng (đã có copy tiếng Anh trong `useAnkiExport`, cần xác nhận UX thực tế khi chạy)
- [ ] Gemini API lỗi/quota hết → kiểm tra retry + thông báo lỗi cho user (xem `lib/gemini.ts` đã có retry chưa, test thực tế)
- [ ] TTS lỗi → flow tiếp tục, card tạo không có audio (không crash)
- [ ] Unsplash lỗi → flow tiếp tục, card tạo không có ảnh (không crash)
- [ ] Nhập từ trùng → có cảnh báo cho user trước khi tạo trùng entry

---

## PHASE 4 — Hoàn thiện & Testing

### 4.1 UI/UX Polish — phần lớn đã xong qua Design Refactor (Phase 5)

- [x] Responsive (mobile drawer + breakpoints) — đã làm trong Design Refactor
- [x] A11y (focus-visible ring, không còn `focus:ring-0`) — đã làm trong Design Refactor
- [x] Motion tiết chế (`transition 150ms`, `active:scale-[0.98]`) — đã làm trong Design Refactor
- [ ] Loading skeletons — chưa có, hiện dùng `LoadingOverlay` (modal) cho generate; các bảng/list dùng `emptyMessage="Loading..."` dạng text — cân nhắc có cần skeleton riêng không (tối giản → có thể bỏ qua)
- [ ] Toast notifications — hiện dùng `alert()` (vd. `useAnkiExport`); cân nhắc thay bằng toast nếu muốn UX mượt hơn — **không bắt buộc, để mở quyết định cho user**
- [ ] Keyboard shortcuts (`Ctrl+Enter` submit, `Esc` cancel edit) — chưa làm
- [x] ~~Dark mode (admin UI)~~ — **bỏ khỏi scope**: Design Refactor đã quyết định giữ 1 tone màu trung tính ấm duy nhất; dark mode không nằm trong mục tiêu tối giản đã thống nhất

### 4.2 Testing thủ công — phụ thuộc vào Phase 3 (chạy cùng lúc)

- [ ] Test 1–4: Tạo card mẫu cho cả 4 loại (Chinese "你好", Japanese "ありがとう", English "serendipity", IT "REST API") — đủ card type + field đặc thù (collocations/analogy)
- [ ] Test 5: Card hiển thị đẹp trong Anki Desktop (font, layout đúng theo template đã setup ở 0.2)
- [ ] Test 6: Sync AnkiWeb → thiết bị khác, font CJK hiển thị đúng
- [ ] Test 7: Session persistence — tạo 5 từ liên tiếp, chỉ cần nhập từ mới mỗi lần
- [ ] Test 8: Admin CRUD — thêm/sửa/xoá category, topic, card type, deck, content type qua `/admin`
- [ ] Test 9: Deck mapping tự động (trùng với 3.4, chạy gộp)
- [ ] Test 10: Anki Desktop đóng → error handling đúng UX (trùng với 3.5)
- [ ] Test 11: Trùng từ → cảnh báo đúng (trùng với 3.5)
- [ ] Test 12: History — hiển thị, filter, search, click vào row → sang `/history/[id]`

### 4.3 Documentation

- [ ] **Viết lại `README.md`** — hiện vẫn là boilerplate mặc định của `create-next-app` (chưa từng được viết). Cần:
    - Giới thiệu dự án + workflow chính
    - Hướng dẫn setup từ đầu (lấy API keys, cấu hình `.env.local`)
    - Hướng dẫn cài AnkiConnect + tạo deck/note type/template
    - Cách chạy project (`npm run dev`, `npm run seed`)
    - Hướng dẫn dùng trang Admin
    - Troubleshooting thường gặp (Anki chưa mở, seed chưa chạy...)
    - ⚠️ **Quyết định ngôn ngữ README cần xác nhận lại với user** — kế hoạch Design Refactor có ghi "viết tiếng Nhật" ở dòng kết, nhưng checklist gốc ghi "tiếng Việt"; hai nguồn mâu thuẫn nhau, **chưa chốt** — hỏi user trước khi viết

---

## 📊 Tóm tắt tiến độ (đối chiếu thực tế 2026-06-07)

| Phần                          | Nội dung                                         | Trạng thái                                                           |
| ----------------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| Phase 0 — Setup               | Code/project setup                               | ✅ Xong (file-level) · Anki Desktop + seed data: `[?]` cần tự verify |
| Phase 1 — Backend             | Toàn bộ API routes + lib                         | ✅ Xong 100%                                                         |
| Phase 2 — UI/Pages            | Toàn bộ component + 7 trang                      | ✅ Xong 100%                                                         |
| Phase 5 — Design Refactor     | Design system + English copy + responsive + docs | ✅ Xong 100%                                                         |
| **Phase 3 — E2E Integration** | **Test luồng thật với Anki + Firestore**         | 🔲 **Chưa bắt đầu — ưu tiên cao nhất**                               |
| Phase 4 — Testing & Docs      | Manual QA + README                               | 🔲 Phần lớn chưa làm (UI polish phần lớn đã xong qua Phase 5)        |

---

## 🚦 Đề xuất thứ tự ưu tiên tiếp theo

```
BƯỚC 1 — Xác nhận nền tảng đã sẵn sàng (nhanh, làm trước)
  ├── 0.1 Kiểm tra API key còn hiệu lực
  ├── 0.2 Verify Anki Desktop: AnkiConnect + Deck + Note Type + Template (thủ công, [?])
  └── 0.4 Verify Firestore đã seed (mở /admin, /create xem dropdown có data chưa; chạy `npm run seed` nếu chưa)

BƯỚC 2 — Test luồng E2E thật (Phase 3 + 4.2 chạy song song, vì là cùng một việc)
  ├── 3.2 Chinese flow trước (đủ field nhất) → Japanese → English
  ├── 3.3 IT flow
  ├── 3.4 Deck → Form mapping
  └── 3.5 Error handling (Anki đóng, Gemini lỗi, TTS lỗi, Unsplash lỗi, từ trùng)

BƯỚC 3 — Phần còn thiếu nhỏ (tuỳ chọn, làm nếu còn thời gian)
  ├── 4.1 Keyboard shortcuts, toast notifications (nếu muốn UX mượt hơn alert())
  └── 4.3 Viết README.md — CẦN HỎI USER trước: README tiếng Việt hay tiếng Nhật?
```

---

## ✅ PHASE 5 — Design Refactor (hoàn thành 2026-06)

> Phạm vi: toàn bộ UI (trang hiện có + trang mới). Kế hoạch chi tiết: `flashcard/plans/design-refactor-plan-2026-06-07.md`. Không đổi business logic / enum / khóa dữ liệu Firestore.

- [x] **Phase 1 — Design system foundation**: hợp nhất token màu/font/radius/shadow trong `app/globals.css` (`@theme`, Tailwind v4), thêm `--color-on-primary`, `<html lang="en">`
- [x] **Phase 2 — Chuẩn hoá shared UI primitives**: `Button` (thêm size `xl`), `Badge`, `Card`, `StatCard`, `Tabs`, `EmptyState`, `FormField`, `Modal`, `PageHeader`, `FilterBar`, `DataTable` — xoá hardcode `text-gray-*`, `focus:ring-0`, thống nhất `rounded-*` theo phân cấp (full/lg/xl/md)
- [x] **Phase 3 — Refactor trang hiện có**: Create, Preview, History — chuyển toàn bộ copy sang tiếng Anh, áp design system mới
- [x] **Phase 4 — Build trang mới**: Dashboard (`/dashboard`), History Detail (`/history/[id]`), Settings (`/settings`), Admin (`/admin`) — xem mục 2.4–2.7
- [x] **Phase 5 — Polish**: a11y (focus-visible ring bắt buộc), **responsive mobile** (xem dưới), motion tiết chế (`transition 150ms`, `active:scale-[0.98]`), dọn dead code
- [x] **Phase 6 — Cập nhật tài liệu**: `docs/design/DESIGN.md` (rewrite v3.0), `docs/design/COMPONENT.md` (rewrite), `docs/tasks.md` (mục này), `CLAUDE.md` (bảng Key Directories)

### 🆕 Bổ sung quan trọng phát sinh trong quá trình refactor

- [x] **Responsive mobile cho `NavigationSidebar`** — sidebar cố định 256px gây vỡ layout nghiêm trọng ở viewport 390px (nội dung bị bóp còn ~134px). Đã viết lại thành: top bar `md:hidden` + drawer trượt (`-translate-x-full` ↔ `translate-x-0`) + backdrop, đóng drawer khi đổi route bằng pattern "adjust state during render" (KHÔNG dùng `useEffect` — tránh lỗi lint `react-hooks/set-state-in-effect`). Xem `docs/design/COMPONENT.md` mục 5 và `DESIGN.md` mục Responsive.
- [x] **Thống nhất UI copy 100% tiếng Anh** — rà soát toàn bộ `app/`, `components/`, `hooks/` bằng regex Unicode (dấu tiếng Việt), sửa các chuỗi hiển thị cho người dùng còn sót (vd. `hooks/usePreviewEntry.ts`, `hooks/useAnkiExport.ts`). Giữ nguyên: enum/data keys, dữ liệu người dùng nhập, prompt Gemini trong `lib/prompts/*.ts`.
- [x] **Sửa lỗi `ConnectedBadge` gọi endpoint không tồn tại** — `/api/anki/status` (404 lặp lại mỗi 30s) → đổi sang `/api/anki/connect` (endpoint thật, đã verify trả 200/503 đúng theo trạng thái Anki).
- [x] **Phát hiện & fix bug collision token `--spacing-*`** — định nghĩa `--spacing-sm: 8px` trong `@theme` đè lên scale kích thước có sẵn của Tailwind, khiến `max-w-sm`/`w-sm` resolve sai (`8px` thay vì `24rem`). Đã xoá block `--spacing-*` khỏi `globals.css`. Ghi lại làm "lesson learned" trong `DESIGN.md`.

### Lưu ý cho người đọc sau

- `2.4–2.7` ở trên đã đánh dấu hoàn thành nhưng KHÔNG theo đúng thứ tự/giả định ban đầu trong checklist gốc (vd. `StatCard` dùng prop `delta`/`icon` thay vì `unit`/`trend`/`trendPositive`; `Card` là wrapper đơn giản, không có `variant`/`header`). **Tham chiếu `docs/design/COMPONENT.md` (đã rewrite, phản ánh đúng code hiện tại) thay vì các mô tả props trong checklist này khi cần spec chính xác.**
- Quyết định kiến trúc: trang **Settings dùng Firebase Client SDK trực tiếp** để đọc/ghi `settings` (không qua `/api/admin/*`) — xem ghi chú trong mục 2.7.

---

## 🧪 PHASE 6 — Runtime Verification Framework (bắt đầu 2026-06-12)

> Port framework kiểm thử runtime từ [cwc-workshops phase-3-verify](https://github.com/anthropics/cwc-workshops/tree/main/how-we-claude-code/phase-3-verify). Hướng dẫn đầy đủ: `docs/VERIFICATION.md`. Lệnh: `npm run verify`. Dashboard dev: `/verify`.

### 6.A — Framework port + pilot specs ✅ (hoàn thành 2026-06-12)

- [x] Core framework: `verify/core/` (types, contract, registry, runner, schema-helpers — zod 4)
- [x] 4 verifiers cắm rời: schema, invariants, dom-contract, a11y
- [x] Harness: `window.__verify` handle, mock-fetch, firestore-stub (vitest-only), Dashboard, UnitPage
- [x] App routes dev-only: `/verify` + `/verify/[unitId]/[fixtureId]` (production → 404)
- [x] vitest + jsdom + matrix test (`npm run verify`); EXPECTED_FAIL: `Badge::probe-empty-label`, `Tabs::probe-active-not-in-list`
- [x] 5 pilot specs: Badge, Button, ProgressBar, StepIndicator, Tabs (instrument `verifyAttrs`)
- [x] Unit tests thuần: `lib/session.ts`, `lib/pendingEntry.ts`

### 6.B — ui/ còn lại + layout (17 units) ✅ (hoàn thành 2026-06-12)

- [x] AnkiFlowLogo, Card, EmptyState, ErrorMessage (allowsEmptyRender), FlowTip, StatCard
- [x] Toggle, TagInput, FilterBar, DataTable, Modal (allowsEmptyRender), LoadingOverlay
- [x] Input / Textarea / Select (form-field.verify.tsx)
- [x] PageHeader, ConnectedBadge (mocks.fetch), NavigationSidebar (mocks.pathname)

### 6.C — create/ + preview/ + history/ (18 units) ✅ (hoàn thành 2026-06-13)

- [x] Thuần props: SectionDivider, SmartEnrichmentBanner, LanguageSelector, EditableField, CollocationEditor, CardList, ImageSelector, CardPreview, AudioPlayer, HistoryTable, WordDetailCard
- [x] mocks.firestore: DeckSelector, CategorySelector, TopicSelector, CardTypeSelector
- [x] Full mocks: LanguageForm, ITForm, GeneralForm (submit → pendingEntry + router.push('/preview'))

### 6.D — admin/ + feature spec (6 units)

- [ ] CategoryManager, CardTypeManager, TopicManager, DeckManager, ContentTypeManager (mocks.firestore CRUD)
- [ ] Feature spec `create-language-flow` (end-to-end create → preview handoff)

### Future work

- [ ] Hooks tests (useSession, usePreviewEntry, useAnkiExport) — cần renderHook tooling
