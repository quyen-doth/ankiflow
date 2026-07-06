# Database Structure — AnkiFlow

> **Database:** Google Firestore (NoSQL, document-based)
> **Phiên bản:** v2.0 (multi-user — Firebase Auth)
> **Lưu ý:** Các quan hệ là logical references — không phải foreign key cứng như SQL.

## Multi-user model (v2.0)

- **Per-user collections** (`entries`, `categories`, `card_types`, `topics`, `decks`, `notification_triggers`): mỗi document có field **`user_id`** = Firebase Auth UID. Mọi query (client + server) filter `where('user_id', '==', uid)`. Firestore Security Rules (`firestore.rules`) chặn truy cập chéo ở tầng DB.
- **`content_types` SHARED**: KHÔNG có `user_id` — dùng chung cho mọi user vì doc ID của nó (`form_language`/`form_it`/`form_general`) chính là giá trị `form_type` (field routing cốt lõi). Chỉ admin sửa được.
- **Master data ID scheme**: khi seed cho user mới, ID = `{defaultId}__{uid}` (vd `cat_daily__abc123`) — FK trong decks re-map bằng nối chuỗi cùng quy tắc. Xem `lib/seed-defaults.ts`.
- **Template `__defaults__`**: các doc master-data với `user_id == '__defaults__'` là bản mẫu admin sửa qua `/admin` ("New-user defaults"); `seedUserDefaults` clone chúng cho user mới. Không phải UID thật.

---

## Tổng quan Collections

| Collection | Mô tả | Scope |
|---|---|---|
| `entries` | Từ vựng đã tạo | Per-user |
| `categories` | Phân loại nội dung | Per-user (+ template) |
| `card_types` | Loại flashcard Anki | Per-user (+ template) |
| `topics` | Chủ đề IT | Per-user (+ template) |
| `decks` | Anki Deck config + Form mapping | Per-user (+ template) |
| `notification_triggers` | Lịch nhắc LINE (admin) | Per-user |
| `content_types` | Cấu hình form nhập liệu (doc id = form_type) | **SHARED** — admin-only write |
| `settings` | 3 loại doc: `{uid}` prefs · `global` flags · `default` secrets | Xem mục Settings |

---

## Chi tiết Collections

### `entries` — Từ vựng đã tạo

Document chính của hệ thống. Lưu toàn bộ thông tin từ vựng cho tất cả ngôn ngữ và form type.

| Field | Type | Mô tả |
|---|---|---|
| `id` | string (PK) | Document ID |
| `user_id` | string | Firebase Auth UID — chủ sở hữu entry (bắt buộc filter trong mọi query) |
| `category_id` | string (FK) | Tham chiếu tới `categories` (nullable) |
| `form_type` | string | Loại form đã dùng: `form_language` / `form_it` / `form_general` |
| `language` | string | Ngôn ngữ: `zh`, `ja`, `en` (nullable, chỉ khi form_type = form_language) |
| `word` | string | Từ vựng (Language form) |
| `term` | string | Thuật ngữ (IT form) |
| `title` | string | Tiêu đề (General form) |
| `meaning_vi` | string | Nghĩa tiếng Việt |
| `definition` | string | Định nghĩa (IT form) |
| `content` | string | Nội dung chi tiết (General form) |
| `note` | string | Ghi chú cá nhân |
| `word_type` | string | Danh từ / động từ / tính từ... |
| `pinyin` | string | Pinyin (Tiếng Trung) |
| `han_viet` | string | Hán Việt (Tiếng Trung) |
| `hiragana` | string | Hiragana (Tiếng Nhật) |
| `katakana` | string | Katakana (Tiếng Nhật) |
| `romaji` | string | Romaji (Tiếng Nhật) |
| `ipa` | string | IPA phonetics (Tiếng Anh) |
| `level` | string | Cấp độ: A1/A2/B1... hoặc N5/N4... |
| `example_sentence` | string | Câu ví dụ |
| `example_translation` | string | Dịch câu ví dụ |
| `collocations` | string[] | Các cụm từ đi kèm |
| `image_url` | string | URL ảnh minh họa |
| `image_credit` | string | Nguồn ảnh (Unsplash...) |
| `audio_url` | string | URL/tên file audio của từ |
| `audio_example_url` | string | URL/tên file audio câu ví dụ |
| `anki_deck` | string | Tên deck Anki đã export vào |
| `anki_note_ids` | number[] | ID các note trong Anki |
| `card_type_ids` | string[] | Tham chiếu tới `card_types` đã chọn |
| `tags` | string[] | Tags trong Anki (AI sinh + user custom) |
| `keywords` | string[] | Từ khóa IT (IT vocab specific) |
| `topic_ids` | string[] | Tham chiếu tới `topics` |
| `difficulty` | string | Độ khó: `easy` / `medium` / `hard` (IT vocab specific) |
| `review_state` | object | Trạng thái SRS đồng bộ từ Anki (ease/interval/due_date/queue...) — nullable |
| `created_at` | timestamp | Thời điểm tạo |
| `updated_at` | timestamp | Thời điểm cập nhật |
| `status` | string | Trạng thái: xem enum bên dưới |

---

**Enum: `status`**

| Value | Ý nghĩa | Transition |
|---|---|---|
| `draft` | Đang soạn, chưa hoàn chỉnh | → `reviewed` |
| `reviewed` | AI đã enriched, sẵn sàng export | → `synced` / `draft` |
| `synced` | Đã export vào Anki thành công | — |

---

### `categories` — Phân loại nội dung

Nhóm entries theo danh mục (ví dụ: Động từ, Danh từ, Thành ngữ...).

| Field | Type | Mô tả |
|---|---|---|
| `id` | string (PK) | Document ID (`{defaultId}__{uid}` khi seed) |
| `user_id` | string | Firebase Auth UID (hoặc `__defaults__` cho bản template) |
| `name` | string | Tên danh mục |
| `form_type` | string | Thuộc form type nào |
| `sort_order` | number | Thứ tự hiển thị (sort in-memory — không dùng orderBy để né composite index) |
| `is_active` | boolean | Đang active hay không |
| `created_at` | timestamp | — |
| `updated_at` | timestamp | — |

---

### `card_types` — Loại flashcard

Định nghĩa các kiểu card Anki (ví dụ: Word→Meaning, Meaning→Word, Cloze...).

| Field | Type | Mô tả |
|---|---|---|
| `id` | string (PK) | Document ID (`{defaultId}__{uid}` khi seed) |
| `user_id` | string | Firebase Auth UID (hoặc `__defaults__`) |
| `code` | string | Mã định danh (unique **theo user** — C4b backlog: chưa enforce) |
| `name` | string | Tên hiển thị |
| `description` | string | Mô tả |
| `form_type` | string | Thuộc form type nào |
| `language` | string | Ngôn ngữ áp dụng |
| `is_default` | boolean | Có được chọn mặc định không |
| `is_active` | boolean | — |
| `sort_order` | number | Thứ tự hiển thị |
| `template` | object | `{ front: string[], back: string[] }` — block layout render Front/Back |
| `created_at` | timestamp | — |

---

### `topics` — Chủ đề IT

Dùng riêng cho IT vocabulary. Entries có thể thuộc nhiều topic.

| Field | Type | Mô tả |
|---|---|---|
| `id` | string (PK) | Document ID (`{defaultId}__{uid}` khi seed) |
| `user_id` | string | Firebase Auth UID (hoặc `__defaults__`) |
| `name` | string | Tên chủ đề (Networks, Security...) |
| `form_type` | string | Luôn `form_it` |
| `is_active` | boolean | — |
| `sort_order` | number | — |
| `created_at` | timestamp | — |

---

### `decks` — Anki Deck Config

Mapping giữa form type và Anki deck. Lưu cấu hình mặc định cho từng deck.

| Field | Type | Mô tả |
|---|---|---|
| `id` | string (PK) | Document ID (`{defaultId}__{uid}` khi seed) |
| `user_id` | string | Firebase Auth UID (hoặc `__defaults__`) |
| `anki_deck_name` | string | Tên deck trong Anki |
| `display_name` | string | Tên hiển thị trên UI |
| `form_type` | string | Form type tương ứng |
| `language` | string | Ngôn ngữ |
| `default_card_type_ids` | string[] | Card types mặc định (FK re-map theo `{id}__{uid}` khi seed) |
| `default_category_id` | string | Category mặc định (FK re-map tương tự, nullable) |
| `is_active` | boolean | — |
| `sort_order` | number | — |
| `created_at` | timestamp | — |

---

### `content_types` — Form Configuration (**SHARED**)

Định nghĩa các loại form nhập liệu. **KHÔNG per-user** — doc ID = giá trị `form_type`
(`form_language`/`form_it`/`form_general`), là field routing cốt lõi toàn app. Dùng chung
cho mọi user; chỉ admin sửa (đổi form cho tất cả). Field `fields[]` (form_fields) nhúng ngay
trong document, không phải sub-collection.

| Field | Type | Mô tả |
|---|---|---|
| `id` | string (PK) | = `form_type` (`form_language`/`form_it`/`form_general`) |
| `code` | string | Mã định danh |
| `name` | string | Tên hiển thị |
| `description` | string | Mô tả |
| `icon` | string | Icon name |
| `fields` | object[] | Mảng form_fields (xem dưới) |
| `default_create_mode` | string | `single` / `batch` |
| `is_active` | boolean | — |
| `sort_order` | number | — |
| `created_at` | timestamp | — |
| `updated_at` | timestamp | — |

---

### `form_fields` — Field Configuration

**Sub-collection / embedded document** bên trong `content_types`.
Định nghĩa từng field sẽ hiển thị trên form nhập liệu.

| Field | Type | Mô tả |
|---|---|---|
| `id` | string (PK) | Document ID |
| `content_type_id` | string (FK) | Tham chiếu tới `content_types` |
| `field_key` | string | Key map tới field trong `entries` |
| `label` | string | Label hiển thị trên form |
| `type` | string | `text` / `select` / `textarea`... |
| `is_required` | boolean | Bắt buộc nhập hay không |
| `is_session_persistent` | boolean | Giữ giá trị giữa các session |
| `sort_order` | number | Thứ tự field trên form |
| `placeholder` | string | Placeholder text |
| `data_source` | string | Nguồn dữ liệu nếu là dropdown |

---

### `notification_triggers` — Lịch nhắc LINE (per-user, admin-only feature)

Cấu hình lịch push LINE. Per-user (`user_id`) nhưng hiện chỉ admin dùng được (LINE token là của chủ app).

| Field | Type | Mô tả |
|---|---|---|
| `id` | string (PK) | Document ID |
| `user_id` | string | Firebase Auth UID |
| `name` | string | Tên trigger |
| `schedule_hours` | number[] | Giờ trong ngày để push |
| `timezone` | string | Múi giờ |
| `deck_filter` / `language_filter` | string[] | Lọc entry để nhắc |
| `words_per_notification` | number | Số từ mỗi lần push |
| `is_active` | boolean | — |

---

### `settings` — 3 loại document (KHÔNG còn singleton)

Từ v2.0, collection `settings` chứa 3 loại doc khác biệt về quyền và mục đích:

**`settings/{uid}`** — preferences của từng user (user tự đọc/ghi doc của mình):

| Field | Type | Default |
|---|---|---|
| `unsplash_enabled` / `tts_enabled` | boolean | `true` — lựa chọn cá nhân (kết hợp AND với global flag) |
| `auto_audio` / `auto_image` | boolean | `true` |
| `allow_duplicate` | boolean | `false` |
| `anki_connect_url` | string | `http://localhost:8765` |

**`settings/global`** — feature flags TOÀN CỤC (mọi user đọc; **chỉ admin ghi** qua `POST /api/admin/global-config`; client-read qua `GlobalConfigProvider` realtime):

| Field | Type | Default | Ghi chú |
|---|---|---|---|
| `ai_model` | string | `claude-haiku-4-5` | Model Claude cho MỌI user (generate route đọc từ đây) |
| `web_search_enabled` | boolean | `false` | Bật web_search cho AI agent |
| `tts_available` | boolean | `true` | Cổng chi phí: tắt → mọi user không dùng TTS được |
| `unsplash_available` | boolean | `true` | Cổng chi phí: tắt → mọi user không dùng Unsplash được |

**`settings/default`** — SECRETS của chủ app (**chỉ admin đọc/ghi** — rules chặn non-admin, tránh lộ token qua network):

| Field | Type | Ghi chú |
|---|---|---|
| `line_channel_access_token` / `line_user_id` | string | LINE credentials |
| `notifications_enabled` | boolean | Bật/tắt tính năng LINE |

> **"Mức trần" (effective flag)**: `effectiveTts = global.tts_available && user.tts_enabled`.
> Admin tắt global → mọi người không dùng được; bật lại → mỗi user về lựa chọn cá nhân cũ
> (2 doc tách biệt nên không mất pref). Xem `hooks/useEffectiveMediaFlags.ts`.

---

## Quan hệ giữa các Collections

```
entries ──(category_id)──► categories
entries ──(topic_ids)────► topics          [many-to-many]
entries ──(card_type_ids)──► card_types    [many-to-many]

decks ──(default_category_id)──► categories
decks ──(default_card_type_ids)──► card_types [many-to-many]

form_fields ──(content_type_id)──► content_types
```

> **Lưu ý Firestore:** Không có JOIN. Khi cần resolve quan hệ, phải fetch
> document tham chiếu thủ công bằng ID, hoặc dùng `Promise.all()` để batch fetch.

---

## ERD Diagram

Diagram được tạo bằng [eraser.io](https://eraser.io) (diagram-as-code).
Source file: `docs/database-diagram.txt`

---

## Ghi chú thiết kế

- `form_type` xuất hiện ở nhiều collection — đây là field routing chính,
  quyết định UI form nào hiển thị và data nào được load.
  **Enum values:**
  | Value | Mô tả |
  |---|---|
  | `form_general` | Từ vựng tổng quát |
  | `form_it` | Từ vựng IT / Công nghệ |
  | `form_language` | Từ vựng ngôn ngữ (Anh, Trung, Nhật) |
- `entries` là collection lớn nhất và có nhiều optional field —
  các field language-specific (pinyin, hiragana...) chỉ có giá trị
  khi `language` tương ứng.
- `settings` KHÔNG còn singleton — 3 loại doc (`{uid}` / `global` / `default`), xem mục Settings.

---

## Security Rules (`firestore.rules` — đã deploy)

Client SDK đọc/ghi Firestore trực tiếp (bypass middleware + API auth), nên rules là tầng
phân quyền cuối cùng. Admin SDK (server routes) bypass rules.

| Collection / doc | read | write |
|---|---|---|
| `entries`, `notification_triggers` | chủ sở hữu | chủ sở hữu (tạo phải gắn đúng `user_id`) |
| `decks`/`categories`/`card_types`/`topics` | chủ sở hữu **+ admin cho `__defaults__`** | như read |
| `content_types` | mọi user đã đăng nhập | **admin only** |
| `settings/global` | mọi user đã đăng nhập | **admin only** |
| `settings/default` | **admin only** | **admin only** |
| `settings/{uid}` | chính chủ | chính chủ |
| (còn lại) | deny | deny |

- **Admin trong rules** = custom claim `request.auth.token.admin == true` (rules không đọc env
  → khác với check `ADMIN_EMAIL` phía server). Đặt bằng `scripts/set-admin-claim.ts`, cần re-login.
- **Composite index**: chỉ `entries (user_id ASC, created_at DESC)` cho dashboard/history +
  `content_types (is_active ASC, sort_order ASC)` cho create page. Các query per-user khác
  cố ý sort in-memory để né composite index (xem `firestore.indexes.json`).