# 📚 API Reference — AnkiFlow Backend

Tài liệu này cung cấp đặc tả chi tiết về các backend API routes được sử dụng trong dự án AnkiFlow. Hệ thống được xây dựng trên Next.js App Router, đóng vai trò làm trung gian kết nối giữa Client (React UI) và các External Services (Firestore, Claude, Google TTS, Unsplash).

> **⚡ Kiến trúc AnkiConnect (từ 2026-07-04):** Mọi lệnh AnkiConnect chạy **client-side** — browser của user gọi trực tiếp `localhost:8765` của chính họ qua `lib/flashcard-service/client.ts` + `client-ops.ts`. **Server KHÔNG BAO GIỜ gọi AnkiConnect** (localhost của server trên Vercel không phải máy user). Các route `/api/anki/*` còn lại chỉ đọc/ghi Firestore và trả dữ liệu để client tự thao tác với Anki. User phải thêm origin của app vào `webCorsOriginList` trong config AnkiConnect addon (xem `docs/REFERENCE.md`).

---

## 1. 🏗️ Sơ đồ Kiến trúc (Architecture Flow)

```mermaid
graph TD
    Client[Client (Next.js UI / Browser)]

    subgraph "Next.js API Routes (Server — Firestore only)"
        EntriesAPI[/api/entries/*]
        AnkiDataAPI[/api/anki/update, resync, sync-srs]
        GenAPI[/api/generate]
        MediaAPI[/api/audio/generate, /api/image]
        HistoryAPI[/api/history/*]
        AdminAPI[/api/admin/*]
    end

    subgraph "External Services"
        AnkiConnect[AnkiConnect plugin — localhost:8765 CỦA USER]
        Claude[Anthropic Claude API]
        TTS[Google Cloud TTS]
        Unsplash[Unsplash API]
        Firestore[(Firebase Firestore)]
    end

    Client <-->|Direct HTTP POST + CORS| AnkiConnect
    Client <-->|REST| EntriesAPI
    Client <-->|REST| AnkiDataAPI
    Client <-->|REST| GenAPI
    Client <-->|REST| MediaAPI
    Client <-->|REST| HistoryAPI
    Client <-->|REST| AdminAPI

    EntriesAPI <-->|Admin SDK| Firestore
    AnkiDataAPI <-->|Admin SDK| Firestore
    GenAPI <-->|SDK| Claude
    MediaAPI <-->|SDK| TTS
    MediaAPI <-->|HTTP GET| Unsplash
    HistoryAPI <-->|Admin SDK| Firestore
    AdminAPI <-->|Admin SDK| Firestore
```

**Pattern chung cho thao tác Anki:** server trả data (GET/POST) → browser thực hiện lệnh AnkiConnect → browser báo kết quả về server để cập nhật Firestore.

---

## 2. 📝 Conventions (Quy chuẩn)

Tất cả các API route đều tuân theo các quy chuẩn sau:

- **Base URL:** `http://localhost:3000` (môi trường local)
- **Data format:** Cả Request (POST/PUT) và Response đều sử dụng định dạng `application/json`.
- **Response Format (Thành công):**
  Trả về một JSON object chứa kết quả. Có thể đi kèm cờ `success: true` đối với thao tác ghi.
    ```json
    {
        "success": true,
        "id": "abc123xyz"
    }
    ```
- **Error Format (Thất bại):**
  Luôn trả về object có key `error` mang thông báo lỗi, kèm theo HTTP status code tương ứng.
    ```json
    {
        "error": "Missing required fields"
    }
    ```
- **HTTP Status Codes phổ biến:**
    - `200 OK`: Request thành công.
    - `400 Bad Request`: Payload hoặc query parameters bị thiếu/sai định dạng.
    - `404 Not Found`: Resource không tồn tại (vd: Document ID).
    - `500 Internal Server Error`: Lỗi server hoặc external service bị lỗi.
    - `503 Service Unavailable`: Dịch vụ phụ thuộc không phản hồi (vd: AnkiConnect chưa mở).

---

## 3. 🔐 Authentication & Authorization (Firebase Auth — multi-user)

AnkiFlow dùng **Firebase Authentication (email/password) + httpOnly session cookie `__session`**.
Middleware chỉ check cookie tồn tại (Edge không chạy Admin SDK); **verify thật** (`verifySessionCookie`)
diễn ra ở mỗi API route qua `withAuth`/`verifySessionUser` (`lib/auth-guard.ts`), trả UID làm tham số handler.

| Route Group | Auth | Ghi chú |
| --- | --- | --- |
| `/api/auth/*` | Public | session (login), signup, logout — chạy khi CHƯA đăng nhập |
| `/api/notifications/line-webhook` | Public (LINE signature) | LINE platform gọi từ ngoài |
| `/api/entries/*`, `/api/anki/*`, `/api/history/*`, `/api/generate`, `/api/audio/generate`, `/api/image` | **`withAuth`** (session cookie) → 401 nếu thiếu/sai | scope data theo UID |
| `/api/admin/global-config` (POST), `/api/notifications/send` | session cookie **+ `email === ADMIN_EMAIL`** → 403 nếu không phải admin | control plane |
| `/api/admin/*` (CRUD legacy) | `withAuth` | không có client caller (UI dùng client SDK) |

**Data isolation:** mọi query `entries` + master data filter `user_id == uid`; ownership check trên
mutation (update/delete entry của user khác → 404). Tầng cuối là **Firestore Security Rules** (client SDK).

**Admin (2 cơ chế độc lập):** server dùng env `ADMIN_EMAIL`; Firestore rules dùng custom claim
`admin:true`. `NEXT_PUBLIC_ADMIN_EMAIL` chỉ gate UI.

---

## 4. ⚙️ Environment Variables (Biến môi trường)

Bảng mapping các biến môi trường cần thiết để các API hoạt động (cấu hình trong `.env`):

| Biến môi trường                  | Dịch vụ tương ứng                  | Routes sử dụng                                                    |
| -------------------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`              | Anthropic Claude API               | `/api/generate`                                                   |
| `GOOGLE_APPLICATION_CREDENTIALS` | Google Cloud Service Account (TTS) | `/api/audio/generate`                                             |
| `UNSPLASH_ACCESS_KEY`            | Unsplash Developer API             | `/api/image`                                                      |
| `FIREBASE_ADMIN_PROJECT_ID`      | Firebase Admin SDK (Auth + Firestore) | tất cả route có `withAuth` + `/api/auth/*`                     |
| `FIREBASE_ADMIN_CLIENT_EMAIL`    | Firebase Admin SDK                 | (như trên)                                                        |
| `FIREBASE_ADMIN_PRIVATE_KEY`     | Firebase Admin SDK                 | (như trên)                                                        |
| `ADMIN_EMAIL`                    | Server-side admin判定             | `/api/admin/global-config`, `/api/notifications/send`, signup (đặt claim) |
| `NEXT_PUBLIC_ADMIN_EMAIL`        | Client-side admin UI gate          | Settings/Admin components (UI only, không phải bảo mật)           |
| `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_USER_ID` | LINE Messaging API     | `/api/notifications/send`                                         |

> `ANKI_CONNECT_URL` (env server) và `API_SECRET`/`x-api-secret` đã bị loại bỏ. URL AnkiConnect giờ per-user (`settings/{uid}.anki_connect_url`, fallback `http://localhost:8765`); auth chuyển sang session cookie.

---

## 5. 📋 Endpoints Summary

| HTTP Method       | Endpoint                       | Chức năng chính                                                                                       |
| ----------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **POST, DELETE**  | `/api/auth/session`            | POST: đổi Firebase ID token → set session cookie; DELETE: revoke + xóa cookie (logout)                |
| **POST**          | `/api/auth/signup`             | Tạo user (Admin SDK) + seed defaults + đặt admin claim nếu email == ADMIN_EMAIL                       |
| **GET, POST**     | `/api/admin/global-config`     | GET: đọc `settings/global`; POST (**admin only**): ghi feature flags (ai_model/tts/unsplash)          |
| **POST**          | `/api/entries/save`            | Lưu Entry vào Firestore (deferred `reviewed` hoặc `synced` kèm note ids)                              |
| **GET, POST**     | `/api/entries/sync`            | GET: jobs (entries `reviewed` + card_types) để client tạo notes; POST: nhận kết quả → update `synced` |
| **POST**          | `/api/entries/check-duplicate` | Kiểm tra từ/thuật ngữ trùng lặp                                                                       |
| **PUT**           | `/api/anki/update`             | Update Entry Firestore + trả regen payload để client tự cập nhật note Anki                            |
| **POST**          | `/api/anki/resync`             | Trả entries `synced` + card_types (theo filter) để client regenerate notes                            |
| **GET, POST**     | `/api/anki/sync-srs`           | GET: noteIds để client đọc SRS từ Anki; POST: nhận cardsInfo → update review_state                    |
| **POST**          | `/api/generate`                | AI (Claude agent) sinh nội dung flashcard                                                             |
| **POST**          | `/api/audio/generate`          | Render TTS → trả về base64 (client tự store vào Anki media nếu cần)                                   |
| **GET**           | `/api/image`                   | Tìm kiếm ảnh minh hoạ trên Unsplash                                                                   |
| **GET, POST**     | `/api/history`                 | Truy xuất danh sách / Thêm mới Entry lịch sử tạo card                                                 |
| **GET, PUT, DEL** | `/api/history/[id]`            | Đọc chi tiết, cập nhật, xóa 1 Entry lịch sử                                                           |
| **CRUD**          | `/api/admin/categories`        | Quản lý Categories phân loại thẻ                                                                      |
| **CRUD**          | `/api/admin/card-types`        | Quản lý danh sách các cấu hình thẻ (Card Type Config)                                                 |
| **CRUD**          | `/api/admin/topics`            | Quản lý Topics cho thẻ IT Vocabulary                                                                  |
| **CRUD**          | `/api/admin/decks`             | Quản lý mapping giữa Anki Deck & Form type mặc định                                                   |
| **GET, PUT**      | `/api/admin/content-types`     | Quản lý cấu hình meta (form fields list) cho các Form type                                            |

**Đã xóa (2026-07-04, chuyển sang client-side qua `lib/flashcard-service/client-ops.ts`):** `GET /api/anki/connect` (→ client `ping()`), `GET+POST /api/anki/decks` (→ `ensureDeck`/`renameDeck`/`deleteDeckWithCleanup`/`setDeckSuspended`/`syncAllDecks`), `POST /api/anki/create` (→ `createNotesForEntry` + `/api/entries/save`), `POST /api/anki/ensure-model` (→ `ensureModel`), `POST /api/audio` , `POST /api/audio/store`, `POST /api/image/store` (→ client `storeMediaFile`).

---

## 6. 📖 Chi tiết API (Endpoint Reference)

### 6.1 Entries & Anki-data Routes (server = Firestore only)

> Lệnh AnkiConnect thực thi trong browser (`lib/flashcard-service/client-ops.ts`). Các route dưới đây chỉ cung cấp/nhận data.

#### `POST /api/entries/save`

Lưu Entry vào Firestore. Dùng cho cả 2 luồng: **deferred** (Save khi Anki đóng — status mặc định `reviewed`) và **synced** (client vừa tạo notes trong Anki xong).

- **Body Params (zod-validated):**
    ```ts
    {
      "entryData": object,          // Bắt buộc — dữ liệu Entry
      "anki_note_ids"?: number[],   // Optional — note ids client vừa tạo trong Anki
      "status"?: "draft" | "reviewed" | "synced"  // Optional — mặc định "reviewed"
    }
    ```
- **Response (200 OK):** `{ "success": true, "entryId": "firestoreDocId123" }`
- **Response (400):** `{ "error": "Invalid request body", "issues": [...] }`

#### `GET /api/entries/sync`

Trả các entry `status == 'reviewed'` kèm card_types (có template) để client tự `buildNotes` → tạo notes trong Anki. Entry giữ nguyên `audio_url`/`image_url` (data-URL) — client cần chúng để `storeMediaFile` vào Anki media.

- **Response (200 OK):**
    ```json
    {
        "jobs": [
            {
                "entryId": "doc123",
                "entry": { "...": "..." },
                "cardTypes": [{ "id": "ct1", "name": "...", "code": "...", "template": {} }]
            }
        ]
    }
    ```

#### `POST /api/entries/sync`

Client báo kết quả tạo notes; server update từng entry sang `synced` (Promise.allSettled — 1 entry hỏng không fail cả batch). **Client PHẢI kiểm tra response** — nếu bỏ qua, notes đã nằm trong Anki nhưng status chưa ghi → sync lại sẽ tạo notes trùng.

- **Body Params (zod-validated):** `{ "results": [ { "entryId": "doc123", "noteIds": [1682490000000] } ] }`
- **Response (200 OK):** `{ "synced": 3, "failed": 0 }`

#### `PUT /api/anki/update`

Cập nhật Entry trong Firestore, rồi TRẢ VỀ dữ liệu để client tự sinh lại note trong Anki (best-effort — Anki offline không chặn việc lưu).

- **Body Params:**
    ```ts
    {
      "entryId": string,   // Bắt buộc — Firestore document ID
      "updates"?: object   // Partial Entry update cho Firestore
    }
    ```
- **Response (200 OK):**
    ```json
    { "success": true, "entry": { "...": "..." }, "cardTypes": [], "noteIds": [123] }
    ```
- **Response (400):** `{ "error": "Missing entryId" }`
- Client flow (`hooks/useEntryEdit.ts`): PUT → `regenerateNotesForEntry(client, entry, cardTypes)`.

#### `POST /api/anki/resync`

Trả entries `synced` (lọc theo filter, đã strip `audio_url`/`audio_example_url` để tránh response nhiều MB) + card_types để client regenerate Front/Back trong Anki. Không ghi lại Firestore.

- **Body Params:** `{ "formType"?: string, "deckName"?: string, "cardTypeId"?: string }`
- **Response (200 OK):** `{ "entries": [...], "cardTypes": [...] }`
- Client flow (`components/settings/ResyncCards.tsx`): POST → loop `regenerateNotesForEntry(...)`.

#### `GET /api/anki/sync-srs`

Trả toàn bộ `anki_note_ids` của entries `synced` để client truy vấn SRS state từ Anki (`findCards('nid:a,b,...')` theo chunk → `cardsInfo`).

- **Response (200 OK):** `{ "noteIds": [123, 456] }`

#### `POST /api/anki/sync-srs`

Client gửi cardsInfo từ Anki; server map sang `ReviewState` (ANKI_QUEUE_MAP, ease/1000, due×1000) + batch update `review_state`.

- **Body Params (zod-validated):** `{ "cards": [ { "noteId": 123, "interval": 5, "ease": 2500, "due": 1750000000, "lapses": 0, "queue": 2 } ] }`
- **Response (200 OK):** `{ "success": true, "synced": 10, "total": 12 }`

---

### 6.2 AI Generation

#### `POST /api/generate`

Gọi Claude (AI agent, tool-based) để sinh thông tin từ vựng hoặc IT vocabulary. Model bị ép gọi tool `submit_card` nên output luôn đúng schema (validate bằng zod). Model lấy từ `settings.ai_model` (mặc định `claude-haiku-4-5`). Trả về JSON structure đã được map sẵn.

- **Body Params:**
    ```ts
    {
      "form_type": "form_language" | "form_it", // Bắt buộc — FormType enum value
      "word"?: "string",                         // Bắt buộc nếu form_type = form_language
      "language"?: "zh" | "ja" | "en",           // LanguageType enum value
      "term"?: "string",                         // Bắt buộc nếu form_type = form_it
      "topics"?: ["string"]                      // Array các topic names
    }
    ```
- **Response (200 OK):**
    ```json
    {
        "content": {
            "word": "书",
            "pinyin": "shū",
            "meaning_vi": "sách",
            "example_sentence": "这是一本书",
            "...": "..."
        }
    }
    ```
- **Ví dụ Curl:**
    ```bash
    curl -X POST http://localhost:3000/api/generate \
         -H "Content-Type: application/json" \
         -d '{"form_type": "form_language", "language": "zh", "word": "书"}'
    ```

---

### 6.3 Media Services

> Việc store media vào Anki (`storeMediaFile`) giờ chạy client-side trong `createNotesForEntry`/`storeAudioMedia`/`storeImageMedia` (`lib/flashcard-service/client-ops.ts`) — các route `/api/audio` (combined) và `/api/audio/store`, `/api/image/store` đã bị xóa.

#### `POST /api/audio/generate`

Render TTS — trả về base64 audio. Audio được giữ dạng data-URL trong entry (`audio_url`); client store vào Anki media lúc export/sync.

- **Body Params:**
    ```ts
    {
      "text": "string",       // Bắt buộc
      "language": "zh" | "ja" | "en",  // Bắt buộc
      "filename": "string"    // Bắt buộc — echo lại trong response (server không lưu file)
    }
    ```
- **Response (200 OK):**
    ```json
    { "success": true, "base64": "<base64-encoded-mp3>", "filename": "zh_shu_123.mp3" }
    ```

#### `GET /api/image`

Tìm kiếm và trả về danh sách ảnh vuông (squarish) trên Unsplash dựa theo từ khoá.

- **Query Params:**
    - `keyword`: (Bắt buộc) Từ khoá tìm kiếm.
    - `count`: (Optional, default 5) Số lượng ảnh cần lấy.
- **Response (200 OK):**
    ```json
    {
        "images": [
            {
                "id": "abc123_unsplash",
                "url": "https://images.unsplash.com/...",
                "thumb": "https://images.unsplash.com/...&w=200",
                "credit_name": "John Doe",
                "credit_url": "https://unsplash.com/@johndoe"
            }
        ]
    }
    ```

---

### 6.4 Duplicate Check

#### `POST /api/entries/check-duplicate`

Kiểm tra xem từ/thuật ngữ đã tồn tại trong Firestore hay chưa. So sánh case-insensitive trên field `word`, `term`, hoặc `title`.

- **Body Params:**
    ```ts
    {
      "word": "string",                    // Bắt buộc — từ cần kiểm tra
      "language"?: "zh" | "ja" | "en"      // Optional — filter theo ngôn ngữ
    }
    ```
- **Response (200 OK):**
    ```json
    {
        "duplicates": [{ "id": "doc123", "word": "书", "meaning_vi": "sách", "status": "synced", "created_at": "..." }]
    }
    ```
- **Response (400):** `{ "error": "Missing word" }`

---

### 6.5 History (Entries Collection)

Tương tác với bảng (collection) `entries` trong Firestore để lưu dấu vết người học.

#### `GET /api/history`

- **Query Params:** `limit` (default: 50), `form_type`, `category_id`, `keyword`
- **Response (200 OK):**
    ```json
    { "entries": [ { "id": "doc123", "word": "书", "status": "synced", ... } ] }
    ```

#### `POST /api/history`

- **Body Params:** `<Entry object>`
- **Response (200 OK):** `{ "success": true, "id": "doc123" }`

#### `GET /api/history/[id]`

Lấy chi tiết 1 entry.

#### `PUT /api/history/[id]`

- **Body Params:** `<Partial Entry update>`

#### `DELETE /api/history/[id]`

Xoá hẳn record.

---

### 6.6 Admin CRUD (Collections Manager)

API Group dùng để quản lý schema và cấu hình drop-down list trong ứng dụng (Category, Topic, Deck Configs). Hầu hết đều đi theo kiến trúc RESTful CRUD tiêu chuẩn.

#### Nhóm `/api/admin/categories` & `/api/admin/topics` & `/api/admin/card-types` & `/api/admin/decks`

- **GET:** Trả về array documents tương ứng. Có thể nhận filter params (ví dụ: `?form_type=form_language`). Luôn sort bằng trường `sort_order` hoặc `name`.
- **POST:**
    - Body payload là toàn bộ document mới.
    - _System behaviour:_ Tự động gắn `created_at`, `updated_at`. Default `is_active = true`.
- **PUT:**
    - Body payload: `{ "id": "docId", "name": "New Name", ... }`
- **DELETE:**
    - **Thực thi:** Có 2 pattern.
        1. Đối với `categories`: Thay vì hard-delete, nhận query `?id=xyz&is_active=false` để thực hiện Soft-Delete (toggle state).
        2. Đối với các bảng còn lại: Gọi `?id=xyz` để Hard-Delete.

#### Nhóm `/api/admin/content-types`

Quản lý cấu trúc form động (UI sẽ render list input nào).

- **GET**: Trả về document chứa config.
- **PUT**: Cập nhật mảng `fields`.
