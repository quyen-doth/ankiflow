# Database Structure — AnkiFlow

> **Database:** Google Firestore (NoSQL, document-based)
> **Phiên bản:** v1.1
> **Lưu ý:** Các quan hệ là logical references — không phải foreign key cứng như SQL.

---

## Tổng quan Collections

| Collection | Mô tả | Màu |
|---|---|---|
| `entries` | Từ vựng đã tạo | Indigo |
| `categories` | Phân loại nội dung | Amber |
| `card_types` | Loại flashcard Anki | Violet |
| `topics` | Chủ đề IT | Orange |
| `decks` | Anki Deck config + Form mapping | Sky |
| `content_types` | Cấu hình form nhập liệu | Emerald |
| `form_fields` | Sub-collection embedded trong content_types | Green |
| `settings` | Cấu hình hệ thống | Slate |

---

## Chi tiết Collections

### `entries` — Từ vựng đã tạo

Document chính của hệ thống. Lưu toàn bộ thông tin từ vựng cho tất cả ngôn ngữ và form type.

| Field | Type | Mô tả |
|---|---|---|
| `id` | string (PK) | Document ID |
| `user_id` | string | User ID (`local-user` Phase 1, Firebase Auth UID Phase 3) |
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
| `id` | string (PK) | Document ID |
| `name` | string | Tên danh mục |
| `form_type` | string | Thuộc form type nào |
| `sort_order` | number | Thứ tự hiển thị |
| `is_active` | boolean | Đang active hay không |
| `created_at` | timestamp | — |
| `updated_at` | timestamp | — |

---

### `card_types` — Loại flashcard

Định nghĩa các kiểu card Anki (ví dụ: Word→Meaning, Meaning→Word, Cloze...).

| Field | Type | Mô tả |
|---|---|---|
| `id` | string (PK) | Document ID |
| `code` | string | Mã định danh (unique) |
| `name` | string | Tên hiển thị |
| `description` | string | Mô tả |
| `form_type` | string | Thuộc form type nào |
| `language` | string | Ngôn ngữ áp dụng |
| `is_default` | boolean | Có được chọn mặc định không |
| `is_active` | boolean | — |
| `sort_order` | number | Thứ tự hiển thị |
| `created_at` | timestamp | — |

---

### `topics` — Chủ đề IT

Dùng riêng cho IT vocabulary. Entries có thể thuộc nhiều topic.

| Field | Type | Mô tả |
|---|---|---|
| `id` | string (PK) | Document ID |
| `name` | string | Tên chủ đề (Networks, Security...) |
| `form_type` | string | — |
| `is_active` | boolean | — |
| `sort_order` | number | — |
| `created_at` | timestamp | — |

---

### `decks` — Anki Deck Config

Mapping giữa form type và Anki deck. Lưu cấu hình mặc định cho từng deck.

| Field | Type | Mô tả |
|---|---|---|
| `id` | string (PK) | Document ID |
| `anki_deck_name` | string | Tên deck trong Anki |
| `display_name` | string | Tên hiển thị trên UI |
| `form_type` | string | Form type tương ứng |
| `language` | string | Ngôn ngữ |
| `default_card_type_ids` | string[] | Card types mặc định khi export |
| `default_category_id` | string | Category mặc định |
| `is_active` | boolean | — |
| `sort_order` | number | — |
| `created_at` | timestamp | — |

---

### `content_types` — Form Configuration

Định nghĩa các loại form nhập liệu. Mỗi content type có một bộ `form_fields` riêng.

| Field | Type | Mô tả |
|---|---|---|
| `id` | string (PK) | Document ID |
| `code` | string | Mã định danh (unique) |
| `name` | string | Tên hiển thị |
| `description` | string | Mô tả |
| `icon` | string | Icon name |
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

### `settings` — Cấu hình hệ thống

Single document — lưu config toàn cục của app.

| Field | Type | Mô tả | Default |
|---|---|---|---|
| `id` | string (PK) | Document ID | — |
| `unsplash_enabled` | boolean | Bật/tắt tích hợp Unsplash | `true` |
| `tts_enabled` | boolean | Bật/tắt Text-to-Speech | `true` |
| `ai_model` | string | Model Claude đang dùng | `claude-haiku-4-5` |
| `web_search_enabled` | boolean | Cho phép AI agent dùng tool web_search | `false` |
| `anki_connect_url` | string | URL AnkiConnect local | `http://localhost:8765` |
| `allow_duplicate` | boolean | Cho phép tạo entry trùng từ | `false` |
| `auto_audio` | boolean | Tự động tạo audio khi generate | `true` |
| `auto_image` | boolean | Tự động tìm ảnh khi generate | `true` |
| `updated_at` | timestamp | Thời điểm cập nhật cuối | — |

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
- `settings` là singleton document — chỉ có 1 document duy nhất trong collection.