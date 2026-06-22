# 📚 API Reference — AnkiFlow Backend

Tài liệu này cung cấp đặc tả chi tiết về các backend API routes được sử dụng trong dự án AnkiFlow. Hệ thống được xây dựng trên Next.js App Router, đóng vai trò làm trung gian kết nối giữa Client (React UI) và các External Services (Firestore, AnkiConnect, Claude, Google TTS, Unsplash).

---

## 1. 🏗️ Sơ đồ Kiến trúc (Architecture Flow)

```mermaid
graph TD
    Client[Client (Next.js UI)]
    
    subgraph "Next.js API Routes (Server)"
        AnkiAPI[/api/anki/*]
        GenAPI[/api/generate]
        MediaAPI[/api/audio, /api/image]
        HistoryAPI[/api/history/*]
        AdminAPI[/api/admin/*]
    end
    
    subgraph "External Services"
        AnkiConnect[AnkiConnect plugin localhost:8765]
        Claude[Anthropic Claude API]
        TTS[Google Cloud TTS]
        Unsplash[Unsplash API]
        Firestore[(Firebase Firestore)]
    end
    
    Client <-->|REST| AnkiAPI
    Client <-->|REST| GenAPI
    Client <-->|REST| MediaAPI
    Client <-->|REST| HistoryAPI
    Client <-->|REST| AdminAPI
    
    AnkiAPI <-->|Local HTTP POST| AnkiConnect
    AnkiAPI -->|Admin SDK| Firestore
    
    GenAPI <-->|SDK| Claude
    
    MediaAPI <-->|SDK| TTS
    MediaAPI <-->|HTTP GET| Unsplash
    MediaAPI -->|Local HTTP POST| AnkiConnect
    
    HistoryAPI <-->|Admin SDK| Firestore
    AdminAPI <-->|Admin SDK| Firestore
```

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

## 3. 🔐 Authentication & Authorization

Vì AnkiFlow là một web app **local-first** được thiết kế chạy trên localhost của một người dùng duy nhất, hiện tại hệ thống API chưa tích hợp Identity Provider (IdP).

| Route Group | Auth Type | Ghi chú / Rủi ro |
|---|---|---|
| `/api/anki/*` | Public | An toàn khi chạy local |
| `/api/generate` | Public | API key bảo vệ server-side |
| `/api/history/*` | `x-api-secret` header | ✅ Đã bảo vệ. TODO: Firebase Auth ở Phase 3 |
| `/api/admin/*` | `x-api-secret` header | ✅ Đã bảo vệ. TODO: RBAC ở Phase 3 |

**Data isolation:** Mọi Firestore query trên collection `entries` đều filter theo `user_id`. Phase 1 dùng constant `local-user`. Phase 3: thay bằng UID từ Firebase Auth token — không cần migration data vì field đã có sẵn.

---

## 4. ⚙️ Environment Variables (Biến môi trường)

Bảng mapping các biến môi trường cần thiết để các API hoạt động (cấu hình trong `.env.local`):

| Biến môi trường | Dịch vụ tương ứng | Routes sử dụng |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic Claude API | `/api/generate` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Google Cloud Service Account (TTS) | `/api/audio` |
| `UNSPLASH_ACCESS_KEY` | Unsplash Developer API | `/api/image` |
| `ANKI_CONNECT_URL` | Cổng HTTP của AnkiConnect | `/api/anki/*` , `/api/audio` |
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase Admin SDK | `/api/admin/*`, `/api/history/*`, `/api/anki/create` |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Firebase Admin SDK | `/api/admin/*`, `/api/history/*`, `/api/anki/create` |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Firebase Admin SDK | `/api/admin/*`, `/api/history/*`, `/api/anki/create` |

---

## 5. 📋 Endpoints Summary

| HTTP Method | Endpoint | Chức năng chính |
|---|---|---|
| **GET** | `/api/anki/connect` | Kiểm tra kết nối với Anki Desktop |
| **GET** | `/api/anki/decks` | Fetch danh sách deck từ Anki |
| **POST** | `/api/anki/create` | Đẩy notes vào Anki & Lưu Entry log vào Firestore |
| **PUT** | `/api/anki/update` | Cập nhật notes trong Anki & Entry trong Firestore |
| **POST** | `/api/generate` | AI (Claude agent) sinh nội dung flashcard |
| **POST** | `/api/audio` | TTS + store vào Anki (combined, backward-compatible) |
| **POST** | `/api/audio/generate` | Chỉ render TTS → trả về base64 |
| **POST** | `/api/audio/store` | Chỉ store base64 vào Anki media folder |
| **GET** | `/api/image` | Tìm kiếm ảnh minh hoạ trên Unsplash |
| **POST** | `/api/entries/check-duplicate` | Kiểm tra từ/thuật ngữ trùng lặp |
| **GET, POST** | `/api/history` | Truy xuất danh sách / Thêm mới Entry lịch sử tạo card |
| **GET, PUT, DEL** | `/api/history/[id]` | Đọc chi tiết, cập nhật, xóa 1 Entry lịch sử |
| **CRUD** | `/api/admin/categories` | Quản lý Categories phân loại thẻ |
| **CRUD** | `/api/admin/card-types` | Quản lý danh sách các cấu hình thẻ (Card Type Config) |
| **CRUD** | `/api/admin/topics` | Quản lý Topics cho thẻ IT Vocabulary |
| **CRUD** | `/api/admin/decks` | Quản lý mapping giữa Anki Deck & Form type mặc định |
| **GET, PUT** | `/api/admin/content-types` | Quản lý cấu hình meta (form fields list) cho các Form type |

---

## 6. 📖 Chi tiết API (Endpoint Reference)

### 6.1 AnkiConnect Routes

#### `GET /api/anki/connect`
Kiểm tra xem ứng dụng Anki Desktop đã được mở và AnkiConnect plugin có đang phản hồi hay không.

*   **Query Params:** N/A
*   **Response (200 OK):**
    ```json
    { "status": "connected", "version": 6 }
    ```
*   **Response (503 Service Unavailable):**
    ```json
    { "status": "disconnected", "error": "Cannot connect to Anki..." }
    ```

#### `GET /api/anki/decks`
Lấy mảng tên các deck hiện có trong Anki.

*   **Query Params:** N/A
*   **Response (200 OK):**
    ```json
    { "decks": ["Default", "Language::Chinese::HSK1"] }
    ```

#### `POST /api/anki/create`
Thêm note mới vào Anki. Sau khi Anki Connect báo tạo thành công, tiến hành insert bản ghi log Entry vào Firestore.

*   **Body Params:**
    ```ts
    {
      "notes": array, // Danh sách các note object đúng chuẩn AnkiConnect (deckName, modelName, fields, tags...)
      "entryData"?: object // [Optional] Dữ liệu Entry để lưu vào Firestore (category, form_type, word...)
    }
    ```
*   **Response (200 OK):**
    ```json
    { "success": true, "noteIds": [1682490000000], "entryId": "firestoreDocId123" }
    ```

#### `PUT /api/anki/update`
Cập nhật note đã tồn tại trong Anki và/hoặc Entry trong Firestore.

*   **Body Params:**
    ```ts
    {
      "entryId": string,          // Bắt buộc — Firestore document ID
      "updates"?: object,         // Partial Entry update cho Firestore
      "noteUpdates"?: array       // Array { noteId: number, fields: Record<string,string> } cho AnkiConnect
    }
    ```
*   **Response (200 OK):**
    ```json
    { "success": true, "ankiResults": [{ "noteId": 123, "success": true }] }
    ```
*   **Response (400):** `{ "error": "Missing entryId" }`

---

### 6.2 AI Generation

#### `POST /api/generate`
Gọi Claude (AI agent, tool-based) để sinh thông tin từ vựng hoặc IT vocabulary. Model bị ép gọi tool `submit_card` nên output luôn đúng schema (validate bằng zod). Model lấy từ `settings.ai_model` (mặc định `claude-haiku-4-5`). Trả về JSON structure đã được map sẵn.

*   **Body Params:**
    ```ts
    {
      "form_type": "form_language" | "form_it", // Bắt buộc — FormType enum value
      "word"?: "string",                         // Bắt buộc nếu form_type = form_language
      "language"?: "zh" | "ja" | "en",           // LanguageType enum value
      "term"?: "string",                         // Bắt buộc nếu form_type = form_it
      "topics"?: ["string"]                      // Array các topic names
    }
    ```
*   **Response (200 OK):**
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
*   **Ví dụ Curl:**
    ```bash
    curl -X POST http://localhost:3000/api/generate \
         -H "Content-Type: application/json" \
         -d '{"form_type": "form_language", "language": "zh", "word": "书"}'
    ```

---

### 6.3 Media Services

#### `POST /api/audio`
Sử dụng Google Cloud TTS để render giọng đọc, encode sang base64, sau đó gửi thẳng cho AnkiConnect để lưu vào thư mục `collection.media`.

*   **Body Params:**
    ```ts
    {
      "text": "string",
      "language": "zh" | "ja" | "en",
      "filename": "string" // Tên file muốn lưu (vd: zh_shu_123.mp3)
    }
    ```
*   **Response (200 OK):**
    ```json
    { "success": true, "filename": "zh_shu_123.mp3" }
    ```

#### `POST /api/audio/generate`
Chỉ render TTS — trả về base64 audio mà không lưu vào Anki. Dùng khi cần preview audio trước.

*   **Body Params:**
    ```ts
    {
      "text": "string",       // Bắt buộc
      "language": "zh" | "ja" | "en",  // Bắt buộc
      "filename": "string"    // Bắt buộc — tên file dự kiến
    }
    ```
*   **Response (200 OK):**
    ```json
    { "success": true, "base64": "<base64-encoded-mp3>", "filename": "zh_shu_123.mp3" }
    ```

#### `POST /api/audio/store`
Chỉ store base64 audio vào Anki media folder qua AnkiConnect. Dùng sau khi đã generate.

*   **Body Params:**
    ```ts
    {
      "base64": "string",     // Bắt buộc — base64-encoded audio
      "filename": "string"    // Bắt buộc — tên file lưu trong Anki
    }
    ```
*   **Response (200 OK):**
    ```json
    { "success": true, "filename": "zh_shu_123.mp3" }
    ```
*   **Response (503):** AnkiConnect không phản hồi

#### `GET /api/image`
Tìm kiếm và trả về danh sách ảnh vuông (squarish) trên Unsplash dựa theo từ khoá.

*   **Query Params:**
    *   `keyword`: (Bắt buộc) Từ khoá tìm kiếm.
    *   `count`: (Optional, default 5) Số lượng ảnh cần lấy.
*   **Response (200 OK):**
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

*   **Body Params:**
    ```ts
    {
      "word": "string",                    // Bắt buộc — từ cần kiểm tra
      "language"?: "zh" | "ja" | "en"      // Optional — filter theo ngôn ngữ
    }
    ```
*   **Response (200 OK):**
    ```json
    {
      "duplicates": [
        { "id": "doc123", "word": "书", "meaning_vi": "sách", "status": "synced", "created_at": "..." }
      ]
    }
    ```
*   **Response (400):** `{ "error": "Missing word" }`

---

### 6.5 History (Entries Collection)

Tương tác với bảng (collection) `entries` trong Firestore để lưu dấu vết người học.

#### `GET /api/history`
*   **Query Params:** `limit` (default: 50), `form_type`, `category_id`, `keyword`
*   **Response (200 OK):**
    ```json
    { "entries": [ { "id": "doc123", "word": "书", "status": "synced", ... } ] }
    ```

#### `POST /api/history`
*   **Body Params:** `<Entry object>`
*   **Response (200 OK):** `{ "success": true, "id": "doc123" }`

#### `GET /api/history/[id]`
Lấy chi tiết 1 entry.

#### `PUT /api/history/[id]`
*   **Body Params:** `<Partial Entry update>`

#### `DELETE /api/history/[id]`
Xoá hẳn record.

---

### 6.6 Admin CRUD (Collections Manager)

API Group dùng để quản lý schema và cấu hình drop-down list trong ứng dụng (Category, Topic, Deck Configs). Hầu hết đều đi theo kiến trúc RESTful CRUD tiêu chuẩn.

#### Nhóm `/api/admin/categories` & `/api/admin/topics` & `/api/admin/card-types` & `/api/admin/decks`
*   **GET:** Trả về array documents tương ứng. Có thể nhận filter params (ví dụ: `?form_type=form_language`). Luôn sort bằng trường `sort_order` hoặc `name`.
*   **POST:**
    *   Body payload là toàn bộ document mới.
    *   *System behaviour:* Tự động gắn `created_at`, `updated_at`. Default `is_active = true`.
*   **PUT:**
    *   Body payload: `{ "id": "docId", "name": "New Name", ... }`
*   **DELETE:**
    *   **Thực thi:** Có 2 pattern.
        1. Đối với `categories`: Thay vì hard-delete, nhận query `?id=xyz&is_active=false` để thực hiện Soft-Delete (toggle state).
        2. Đối với các bảng còn lại: Gọi `?id=xyz` để Hard-Delete.

#### Nhóm `/api/admin/content-types`
Quản lý cấu trúc form động (UI sẽ render list input nào).
*   **GET**: Trả về document chứa config.
*   **PUT**: Cập nhật mảng `fields`.
