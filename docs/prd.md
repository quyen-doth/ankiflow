
# 📋 PRD — Hệ thống Tự động Tạo Flashcard Anki

**Tên dự án:** AnkiFlow — Personal Flashcard Automation  
**Phiên bản:** v1.1  
**Ngày tạo:** 2026-04-15  
**Cập nhật:** 2026-04-18  
**Tác giả:** hong-quyen  
**Trạng thái:** Draft — đã bổ sung feedback v1  

---

## 1. 🎯 Tổng quan & Mục tiêu

### 1.1 Vấn đề cần giải quyết

Việc tạo flashcard thủ công trong Anki tốn nhiều thời gian và công sức:
- Phải tự tìm nghĩa, ví dụ câu, phát âm, hình ảnh
- Phải tạo thủ công từng loại card (EN→VN, VN→EN, nghe→đoán...)
- Không có quy trình nhất quán
- Không lưu lịch sử từ đã học để tránh trùng lặp

### 1.2 Giải pháp

Xây dựng một **Admin Web UI** chạy local trên MacBook, cho phép:
- Nhập từ/nội dung học → AI tự động điền thông tin
- Preview & chỉnh sửa trước khi tạo
- Tạo nhiều loại card từ một lần nhập
- Tự động đẩy vào Anki Desktop qua AnkiConnect
- Lưu lịch sử vào Firebase Firestore
- Quản lý linh hoạt: categories, card types, templates, form fields qua trang Admin

### 1.3 Mục tiêu chính

| Mục tiêu | Đo lường |
|---|---|
| Giảm thời gian tạo 1 card từ ~10 phút → ~30 giây | Thời gian từ nhập đến Anki |
| Tạo tự động nhiều loại card từ 1 lần nhập | ≥ 4 card types/từ (ngôn ngữ) |
| Hỗ trợ 3 ngôn ngữ: Anh, Trung, Nhật | Đầy đủ metadata đặc thù mỗi ngôn ngữ |
| Chi phí $0/tháng trong free tier | Không vượt giới hạn miễn phí |
| Workflow mượt mà — chỉ cần nhập từ, không cần chọn lại fields cố định | Session persistence |

---

## 2. 👤 Người dùng

**Duy nhất:** Cá nhân (chủ dự án)

**Thiết bị sử dụng:**
- **Tạo card:** MacBook (localhost)
- **Học:** iPad, iPhone (qua AnkiWeb sync)

**Background kỹ thuật:** Fullstack, trình độ trung cấp (HTML/CSS, React, PHP, JS/TS, SQL)

---

## 3. 🗺️ Luồng hoạt động (User Flow)

### 3.1 Flow chính — Tạo card ngôn ngữ

```
[1] Mở Admin UI (localhost:3000)
    ↓
[2] Chọn Ngôn ngữ: "Chinese" (lưu session, lần sau không cần chọn lại)
    ↓
[3] Chọn Anki Deck: "Chinese::HSK2" (lưu session)
    → Khi chọn Deck → hệ thống tự nhận diện form type phù hợp
    ↓
[4] Chọn Category: "Đời sống" (dropdown từ DB, lưu session)
    ↓
[5] Nhập: Từ vựng "书" ← THAO TÁC CHÍNH, các field khác đã lưu sẵn
    ↓
[6] Nhấn "Tạo nháp" → Hệ thống gọi:
    ├── Claude AI agent → sinh nghĩa VN, Pinyin, Hán Việt, ví dụ câu, collocations, từ loại, cấp độ HSK
    ├── Google TTS → tạo audio file (lưu vào Anki media folder)
    └── Unsplash API → tìm ảnh minh họa (lưu URL)
    ↓
[7] Hiển thị Preview tất cả card types sẽ được tạo
    ↓
[8] User review, chỉnh sửa nếu cần
    ↓
[9] Nhấn "Xác nhận & Tạo"
    ↓
[10] AnkiConnect API (localhost:8765) → tạo notes trong Anki Desktop
    ↓
[11] Lưu lịch sử vào Firebase Firestore
    ↓
[12] Quay về form tạo → Từ vựng field được reset, các field khác giữ nguyên
    ↓
[13] Anki Desktop sync thủ công → AnkiWeb → iPad/iPhone ✅
```

### 3.2 Flow phụ — Tạo card chuyên ngành (IT, etc.)

```
[1] Chọn Anki Deck: "Vocabulary::IT" → hệ thống hiện form IT
    ↓
[2] Form nhập liệu hiện fields phù hợp:
    - Thuật ngữ chính (bắt buộc)
    - Định nghĩa ngắn (bắt buộc)
    - Keywords liên quan
    - Chủ đề: checkbox list từ DB (Database, Frontend, Backend...)
    - Difficulty (lưu session)
    ↓
[3-12] Tương tự flow chính (AI bổ sung phần còn lại)
```

---

## 4. 🏗️ Kiến trúc hệ thống

/api/audio/* gồm 3 endpoints: /generate (TTS only), /store (AnkiConnect only), / (combined, backward-compatible).

```
┌─────────────────────────────────────────────────┐
│                   MacBook                        │
│                                                  │
│  ┌─────────────┐    ┌──────────────────────┐    │
│  │  Next.js    │    │   Anki Desktop       │    │
│  │  Admin UI   │◄──►│ + AnkiConnect        │    │
│  │ (port 3000) │    │   (port 8765)        │    │
│  └──────┬──────┘    └──────────────────────┘    │
│         │                    │                   │
│         │              Anki Media                │
│         │              Folder (audio)            │
└─────────┼──────────────────────────────────────-┘
          │
          ▼ External APIs
┌─────────────────────────────────────────────────┐
│  Claude Haiku 4.5  → Sinh nội dung card         │
│  Google Cloud TTS  → Tạo audio phát âm          │
│  Unsplash API      → Tìm ảnh minh họa           │
│  Firebase Firestore→ Lưu lịch sử + config data  │
└─────────────────────────────────────────────────┘
          │
          ▼ Sync
┌─────────────────────────────────────────────────┐
│  AnkiWeb (cloud) → iPad / iPhone                │
└─────────────────────────────────────────────────┘
```

---

## 5. 🛠️ Tech Stack

| Layer | Công nghệ | Phiên bản | Lý do chọn |
|---|---|---|---|
| **Frontend** | Next.js | 14+ (App Router) | Full-stack trong 1 project, React base |
| **Language** | TypeScript | 5+ | Type safety, dễ maintain |
| **Styling** | Tailwind CSS | 3+ | Rapid UI development |
| **Backend** | Next.js API Routes | - | Serverless, đơn giản |
| **Database** | Firebase Firestore | - | Free tier rộng, real-time |
| **AI** | Anthropic Claude Haiku 4.5 | via `@anthropic-ai/sdk` | Tool-use, structured output |
| **TTS** | Google Cloud TTS | - | Free 1M ký tự/tháng |
| **Images** | Unsplash API | v1 | Free, ảnh chất lượng cao |
| **Anki** | AnkiConnect | 6+ | Plugin local, API đầy đủ |
| **Runtime** | Node.js | 20+ | LTS stable |
| **Package Manager** | npm | - | Đi kèm Node.js, không cần cài thêm |

---

## 6. 📂 Data Model

### 6.1 Firestore Collections

#### Collection: `entries` (Từ vựng đã tạo)

```typescript
interface Entry {
  id: string;                    // Auto ID
  
  // Thông tin cơ bản
  category_id: string;           // Tham chiếu tới collection categories
  language?: LanguageType;       // "english" | "chinese" | "japanese" (nếu là ngôn ngữ)
  form_type: FormType;           // Loại form đã dùng
  
  // Nội dung
  word: string;                  // Từ gốc nhập vào
  meaning_vi: string;            // Nghĩa tiếng Việt
  word_type?: string;            // Danh từ, động từ, tính từ...
  
  // Metadata ngôn ngữ đặc thù
  pinyin?: string;               // Chỉ cho tiếng Trung
  han_viet?: string;             // Chỉ cho tiếng Trung
  hiragana?: string;             // Chỉ cho tiếng Nhật
  katakana?: string;             // Chỉ cho tiếng Nhật
  romaji?: string;               // Chỉ cho tiếng Nhật
  ipa?: string;                  // Phiên âm quốc tế (tiếng Anh)
  level?: string;                // HSK1-6, JLPT N5-N1, CEFR A1-C2
  
  // Ví dụ & Collocations (MỚI)
  example_sentence?: string;     // Câu ví dụ ngắn gọn, tự nhiên (ngôn ngữ gốc)
  example_translation?: string;  // Dịch câu ví dụ sang tiếng Việt
  collocations?: string[];       // Các cụm từ hay đi cùng
                                 // Ví dụ: ["蘸点儿醋", "白醋", "米醋"]
  
  // Media
  image_url?: string;            // Unsplash URL
  image_credit?: string;         // Tên photographer
  audio_filename?: string;       // Tên file audio trong Anki media folder
  audio_example_filename?: string; // Audio câu ví dụ
  
  // Anki
  anki_deck: string;             // Tên deck trong Anki
  anki_note_ids: number[];       // IDs của các notes đã tạo
  card_types_created: string[];  // IDs của các card types đã dùng
  anki_tags: string[];           // Tags trong Anki (AI sinh + user custom)
  
  // Chuyên ngành (IT, etc.)
  keywords?: string[];           // Từ khóa liên quan
  topic_ids?: string[];          // Tham chiếu tới collection topics
  difficulty?: 'easy' | 'medium' | 'hard';
  
  // Metadata hệ thống
  created_at: Timestamp;
  updated_at: Timestamp;
  status: 'draft' | 'reviewed' | 'synced';
}
```

#### Collection: `categories` (Phân loại nội dung) — MỚI

```typescript
interface Category {
  id: string;
  name: string;            // Tên hiển thị: "Đời sống", "Kinh doanh", "Du lịch"...
  form_type: FormType;     // Form nào sử dụng category này
  sort_order: number;      // Thứ tự hiển thị
  is_active: boolean;      // Có đang sử dụng không
  created_at: Timestamp;
  updated_at: Timestamp;
}

// Dữ liệu mẫu:
// { name: "Đời sống",       form_type: "language",  sort_order: 1 }
// { name: "Kinh doanh",     form_type: "language",  sort_order: 2 }
// { name: "Du lịch",        form_type: "language",  sort_order: 3 }
// { name: "Ẩm thực",        form_type: "language",  sort_order: 4 }
// { name: "Công nghệ",      form_type: "language",  sort_order: 5 }
// { name: "Giáo dục",       form_type: "language",  sort_order: 6 }
// { name: "Y tế",           form_type: "language",  sort_order: 7 }
// { name: "Văn hóa",        form_type: "language",  sort_order: 8 }
```

#### Collection: `card_types` (Loại card) — MỚI

```typescript
interface CardTypeConfig {
  id: string;
  code: string;            // Mã duy nhất: "word_to_meaning", "audio_to_word"...
  name: string;            // Tên hiển thị: "Từ → Nghĩa VN"
  description: string;     // Mô tả ngắn
  form_type: FormType;     // Thuộc form nào
  language?: LanguageType; // Chỉ áp dụng cho ngôn ngữ cụ thể (null = tất cả)
  is_default: boolean;     // Có được chọn mặc định không
  is_active: boolean;
  sort_order: number;
  created_at: Timestamp;
}

// Dữ liệu mẫu:
// { code: "word_to_meaning",   name: "Từ → Nghĩa VN",          form_type: "language", language: null,      is_default: true }
// { code: "meaning_to_word",   name: "Nghĩa VN → Từ",          form_type: "language", language: null,      is_default: true }
// { code: "audio_to_word",     name: "Nghe → Đoán từ",          form_type: "language", language: null,      is_default: true }
// { code: "image_to_word",     name: "Ảnh → Đoán từ",           form_type: "language", language: null,      is_default: true }
// { code: "fill_in_blank",     name: "Điền vào chỗ trống",      form_type: "language", language: null,      is_default: true }
// { code: "reading_to_word",   name: "Pinyin → Chữ Hán",        form_type: "language", language: "chinese", is_default: false }
// { code: "word_to_reading",   name: "Chữ Hán → Pinyin",        form_type: "language", language: "chinese", is_default: false }
// { code: "concept_to_def",    name: "Khái niệm → Định nghĩa",  form_type: "it",      language: null,      is_default: true }
// { code: "def_to_concept",    name: "Định nghĩa → Khái niệm",  form_type: "it",      language: null,      is_default: true }
```

#### Collection: `topics` (Chủ đề IT) — MỚI

```typescript
interface Topic {
  id: string;
  name: string;            // "Database", "Frontend", "Backend", "Algorithm"...
  form_type: FormType;     // Thuộc form nào (hiện tại: "it")
  is_active: boolean;
  sort_order: number;
  created_at: Timestamp;
}

// Dữ liệu mẫu:
// { name: "Database",         sort_order: 1 }
// { name: "Frontend",         sort_order: 2 }
// { name: "Backend",          sort_order: 3 }
// { name: "Algorithm",        sort_order: 4 }
// { name: "DevOps",           sort_order: 5 }
// { name: "Security",         sort_order: 6 }
// { name: "Architecture",     sort_order: 7 }
// { name: "Network",          sort_order: 8 }
// { name: "OS",               sort_order: 9 }
// { name: "Data Science",     sort_order: 10 }
```

#### Collection: `decks` (Danh sách deck + Mapping)

```typescript
interface DeckConfig {
  id: string;
  anki_deck_name: string;    // Tên đầy đủ trong Anki (ví dụ: "Chinese::HSK1")
  display_name: string;      // Tên hiển thị trên UI
  form_type: FormType;       // ← MỚI: liên kết deck → form type
  language?: LanguageType;   // Chỉ khi form_type là "language"
  default_card_type_ids: string[];  // Card types mặc định cho deck này
  default_category_id?: string;     // Category mặc định (optional)
  is_active: boolean;
  sort_order: number;
  created_at: Timestamp;
}

// Dữ liệu mẫu:
// { anki_deck_name: "Language::Chinese::HSK1", display_name: "Tiếng Trung HSK1", form_type: "language", language: "chinese" }
// { anki_deck_name: "Language::Chinese::HSK2", display_name: "Tiếng Trung HSK2", form_type: "language", language: "chinese" }
// { anki_deck_name: "Language::Japanese::N5",  display_name: "Tiếng Nhật N5",    form_type: "language", language: "japanese" }
// { anki_deck_name: "Language::English::B1",   display_name: "Tiếng Anh B1",     form_type: "language", language: "english" }
// { anki_deck_name: "Vocabulary::IT",          display_name: "IT Vocabulary",     form_type: "it",      language: null }
// { anki_deck_name: "Vocabulary::General",     display_name: "Kiến thức chung",   form_type: "general", language: null }
```

#### Collection: `content_types` (Loại nội dung / Form config) — MỚI

```typescript
interface ContentType {
  id: string;
  code: FormType;              // "language" | "it" | "general" | "custom"
  name: string;                // Tên hiển thị: "Ngôn ngữ", "IT Vocabulary", "Kiến thức chung"
  description: string;
  icon: string;                // Icon class hoặc emoji
  fields: FormFieldConfig[];   // Cấu hình các field hiển thị
  is_active: boolean;
  sort_order: number;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// Cấu hình field cho mỗi loại form
interface FormFieldConfig {
  field_key: string;           // "word", "meaning", "category_id"...
  label: string;               // "Từ vựng", "Nghĩa tiếng Việt"
  type: 'text' | 'textarea' | 'dropdown' | 'checkbox_group' | 'tags';
  is_required: boolean;
  is_session_persistent: boolean;  // Có lưu session không
  sort_order: number;
  placeholder?: string;
  data_source?: string;        // "categories" | "topics" | "decks" — nếu lấy options từ DB
}
```

#### Collection: `settings` (Cấu hình)

```typescript
interface Settings {
  unsplash_enabled: boolean;
  tts_enabled: boolean;
  ai_model: string;          // Model Claude (vd claude-haiku-4-5)
  web_search_enabled: boolean; // Cho phép AI agent dùng tool web_search
  anki_connect_url: string;  // Mặc định: http://localhost:8765
}
```

### 6.2 Enum Types

```typescript
type FormType = 'language' | 'it' | 'general' | 'custom';

type LanguageType = 'english' | 'chinese' | 'japanese';
```

---

## 7. 🔄 Session Persistence Rules — MỚI

### 7.1 Mục đích

Khi user tạo nhiều card liên tiếp (ví dụ: 20 từ HSK1), họ chỉ cần **nhập từ vựng mới**, tất cả field khác được giữ nguyên từ lần nhập trước.

### 7.2 Quy tắc lưu Session theo Form

| Form Type | Fields lưu session | Fields reset mỗi lần |
|---|---|---|
| **Language** | Ngôn ngữ, Anki Deck, Category, Tags, Card Types | Từ vựng, Ghi chú |
| **IT Vocabulary** | Anki Deck, Chủ đề (topics), Difficulty | Thuật ngữ, Định nghĩa, Keywords |
| **General** | Anki Deck | Tiêu đề, Nội dung |

### 7.3 Cơ chế kỹ thuật

```typescript
// Sử dụng localStorage để persist giữa các session
interface SessionState {
  form_type: FormType;
  language?: LanguageType;
  anki_deck?: string;
  category_id?: string;
  tags?: string[];
  card_type_ids?: string[];
  topic_ids?: string[];        // IT form
  difficulty?: string;         // IT form
  last_updated: string;        // ISO timestamp
}

// Key: "ankiflow_session_{form_type}"
// Ví dụ: "ankiflow_session_language"
```

### 7.4 Hành vi cụ thể

1. **Lần đầu mở app** → tất cả field trống, user chọn đầy đủ
2. **Sau khi tạo card thành công** → quay về form, field session được giữ, field nội dung reset
3. **Khi user thay đổi Deck** → nếu deck có `default_category_id` và `default_card_type_ids` → tự động fill
4. **Khi user đổi form type** (Language ↔ IT) → load session riêng của form đó

---

## 8. 🎨 Admin UI — Design System & Component Architecture

### 8.1 Design System

**Triết lý thiết kế:** "Calm Productivity" — giao diện giảm cognitive load để người dùng tập trung vào nội dung. Phong cách Corporate Modern với Tactile Warmth; tông giấy ấm, typography humanist. Tagline bất biến: **COGNITIVE SANCTUARY**.

**Quy tắc "No-Line":** KHÔNG dùng `border 1px` cứng để phân tách section → chỉ dùng tonal shift (thay đổi màu nền/surface).

#### Bảng Color Tokens

| Token | Hex | Tailwind key | Dùng cho |
|---|---|---|---|
| `primary` | `#316342` | `primary` | CTA chính, active state, icon nhấn mạnh |
| `primary-container` | `#4a7c59` | `primary-container` | Hover của primary button |
| `on-primary` | `#ffffff` | — | Text trên nền primary |
| `on-primary-container` | `#e1ffe5` | `primary-text` | Text nhạt trên primary-container |
| `secondary` | `#655d52` | `secondary` | Supporting UI, grounding elements |
| `secondary-container` | `#e9ded0` | `secondary-container` | Tonal fills nhạt |
| `tertiary` | `#6d5622` | `tertiary` | Flow Tips, AI highlights, Ochre accent |
| `tertiary-container` | `#886e38` | `tertiary-container` | Background cho AI badges |
| `tertiary-fixed` | `#ffdea0` | `tertiary-fixed` | Light fill cho AI badges |
| `on-tertiary-fixed` | `#261a00` | `on-tertiary-fixed` | Text trên tertiary-fixed |
| `background` | `#faf6f0` | `app-bg` | **Nền page chính — cream ấm** |
| `surface` | `#ffffff` | — | Card, modal, elevated surface |
| `surface-container-low` | `#f1f4f1` | `surface-low` | Sidebar background |
| `surface-container` | `#ecefeb` | `surface-container` | Hover state nhạt, input background |
| `surface-container-high` | `#e6e9e6` | `surface-high` | Category chips, disabled states |
| `on-surface` | `#181c1b` | `on-surface` | Text chính |
| `on-surface-variant` | `#414942` | `on-surface-var` | Text phụ, icon |
| `outline` | `#717971` | `outline` | Border mặc định |
| `outline-variant` | `#c1c9bf` | `outline-var` | Border nhạt, divider |
| `error` | `#ba1a1a` | `error` | Lỗi, destructive action |
| `error-container` | `#ffdad6` | `error-container` | Background cảnh báo lỗi |
| `inverse-surface` | `#2d312f` | `inverse-surface` | Dark card (AI taxonomy footer) |

#### Bảng Typography Scale

| Cấp | Font | Font-size | Font-weight | Line-height | Dùng cho |
|---|---|---|---|---|---|
| `display` | Newsreader (serif) | 36px | 700 | 1.2 | Greeting, hero title Dashboard |
| `headline-md` | Newsreader (serif) | 24px | 600 | 1.3 | Page title (PageHeader) |
| `headline-sm` | Newsreader (serif) | 18px | 600 | 1.4 | Card title, Modal title, section heading |
| `body-md` | Nunito Sans | 14px | 400 | 1.5 | Mọi paragraph, description, table cell |
| `label-lg` | Nunito Sans | 14px | 700 | 1 | Button text, nav active item |
| `label-sm` | Nunito Sans | 10px | 600 | 1 | Badge text, chip uppercase, field label |

> **Quy tắc font pairing:** Headline = Newsreader serif (`font-serif`). UI text = Nunito Sans (`font-sans`, default). KHÔNG trộn lẫn.

#### Spacing Scale

| Token | Value | Tailwind | Dùng cho |
|---|---|---|---|
| `xs` | 4px | `p-1 / gap-1` | Internal icon padding, tight chip |
| `sm` | 8px | `p-2 / gap-2` | Gap icon-text trong button |
| `md` | 16px | `p-4 / gap-4` | Card internal padding (compact) |
| `lg` | 24px | `p-6 / gap-6` | Card standard padding, section gap |
| `xl` | 32px | `p-8 / gap-8` | Page margin, section spacing |

#### Border Radius Tokens

| Context | Radius | Tailwind | Ví dụ |
|---|---|---|---|
| Card, container, panel | 16px | `rounded-lg` | Mọi card |
| Modal, large dialog | 20px | `rounded-xl` | Dialog box |
| Navigation active item | 12px | `rounded-md` | Nav pill |
| Input, small button | 8px | `rounded` | TextField, inline button |
| Badge, chip, tag, search bar | 9999px | `rounded-full` | Status chip, search |

#### Shadow / Elevation

| Level | Surface | Shadow | Dùng cho |
|---|---|---|---|
| 0 — Base | `bg-app-bg` (#faf6f0) | Không có | Page background |
| 1 — Card | `bg-white` | `shadow-card` (0 4px 20px rgba(46,50,48,0.06)) | Tất cả card, panel |
| 2 — Modal | `bg-white` | `shadow-modal` (0 20px 50px rgba(46,50,48,0.12)) + backdrop blur | Dialog, modal focus |
| Dark — Inverse | `bg-inverse-surface` | Không có | AI feature banner, dark callout |

---

### 8.2 Kiến trúc Component UI

**Vị trí file:** `src/components/ui/` (shared) · `src/components/layout/` (layout) · `src/components/features/` (feature-specific)

**Naming convention:** PascalCase cho component file và export. `cn()` helper từ `lib/utils.ts` (clsx + tailwind-merge). Icon từ `lucide-react`. Client component (`'use client'`) chỉ khi có state/event/browser API.

#### Atomic Design Hierarchy

| Tầng | Mô tả | Ví dụ |
|---|---|---|
| **Atoms** | Thành phần cơ bản, không thể chia nhỏ hơn | Button, Badge, Input, Toggle |
| **Molecules** | Ghép 2+ atoms thành 1 đơn vị chức năng | StatCard, FormField (label + input + error), FilterBar |
| **Organisms** | Thành phần phức hợp, có logic riêng | NavigationSidebar, DataTable, Modal, LoadingOverlay |
| **Templates / Layouts** | Khung page, không chứa data cụ thể | app/layout.tsx (Sidebar + Main), PageHeader |

#### Bảng Component Library

| Component | Tầng | File path | Mô tả ngắn |
|---|---|---|---|
| `AnkiFlowLogo` | Atom | `components/ui/AnkiFlowLogo.tsx` | Brand mark với tagline "COGNITIVE SANCTUARY" |
| `Button` | Atom | `components/ui/Button.tsx` | 4 variants: primary/secondary/ghost/destructive |
| `Badge` | Atom | `components/ui/Badge.tsx` | 7 variants: neutral/active/inactive/pending/ai/language/level |
| `Toggle` | Atom | `components/ui/Toggle.tsx` | Switch on/off với label và description |
| `ProgressBar` | Atom | `components/ui/ProgressBar.tsx` | Thanh tiến trình 2 kích thước (sm/md) |
| `AIBadge` | Atom | `components/ui/AIBadge.tsx` | Badge AI với icon Sparkles, nền tertiary-fixed |
| `ConnectedBadge` | Atom | `components/ui/ConnectedBadge.tsx` | Trạng thái kết nối Anki ở bottom sidebar |
| `FormField` | Molecule | `components/ui/FormField.tsx` | Input + Textarea + Select + FieldWrapper |
| `TagInput` | Molecule | `components/ui/TagInput.tsx` | Input nhập tag với badge removable |
| `StatCard` | Molecule | `components/ui/StatCard.tsx` | Thẻ thống kê: label + số + trend |
| `FlowTip` | Molecule | `components/ui/FlowTip.tsx` | AI tip/callout với icon Lightbulb, nền tertiary |
| `StepIndicator` | Molecule | `components/ui/StepIndicator.tsx` | Danh sách bước có trạng thái completed/active/pending |
| `Card` | Molecule | `components/ui/Card.tsx` | Container card với 4 variants |
| `FilterBar` | Organism | `components/ui/FilterBar.tsx` | Search input + active filter badges + clear all |
| `DataTable` | Organism | `components/ui/DataTable.tsx` | Bảng dữ liệu với custom column render |
| `Modal` | Organism | `components/ui/Modal.tsx` | Dialog với tonal header, Escape close, backdrop |
| `LoadingOverlay` | Organism | `components/ui/LoadingOverlay.tsx` | Màn hình loading với steps + progress + flow tip |
| `NavigationSidebar` | Organism | `components/layout/NavigationSidebar.tsx` | Sidebar fixed 256px với nav items + ConnectedBadge |
| `PageHeader` | Template | `components/layout/PageHeader.tsx` | Header với breadcrumb `›`, title serif, actions slot |
| `CardPreview` | Organism | `components/features/card/CardPreview.tsx` | Preview card 3 tabs: word→meaning/meaning→word/sentence |
| `WordDetailCard` | Organism | `components/features/history/WordDetailCard.tsx` | Card chi tiết từ vựng với border-left primary |
| `IntegrationCard` | Organism | `components/features/settings/IntegrationCard.tsx` | Card trạng thái API integration |

---

### 8.3 Danh sách màn hình & Luồng tương tác

| Màn hình | Route | Primary Components | Shared Components Used |
|---|---|---|---|
| Dashboard | `/dashboard` | `StatCard` (×4), `EntryListItem` | `PageHeader`, `Button`, `Badge` |
| Tạo card mới | `/create` | Form components (Language/IT/General) | `FormField`, `Select`, `Badge`, `Button`, `LoadingOverlay`, `PageHeader` |
| Preview & Review | `/preview` | `CardPreview`, `CollocationEditor`, `ImageSelector`, `AudioPlayer` | `Button`, `Badge`, `Modal`, `Input`, `PageHeader` |
| Lịch sử | `/history` | `HistoryTable` (dùng `DataTable`), `WordDetailCard` | `FilterBar`, `DataTable`, `Badge`, `Button`, `PageHeader` |
| Chi tiết entry | `/history/[id]` | `WordDetailCard`, `CardPreview` | `Badge`, `Button`, `PageHeader` |
| Quản lý (Admin) | `/admin` | `CategoryManager`, `CardTypeManager`, `TopicManager`, `DeckManager`, `ContentTypeManager` | `DataTable`, `Modal`, `FormField`, `Toggle`, `Badge`, `Button`, `PageHeader` |
| Cài đặt | `/settings` | `IntegrationCard` (×4) | `FormField`, `Toggle`, `Button`, `PageHeader` |
| Layout (Root) | `app/layout.tsx` | `NavigationSidebar` | `AnkiFlowLogo`, `ConnectedBadge` |

---

### 8.4 Screen-to-Component Mapping

### Dashboard — `/dashboard`

**Shared components:**
- `PageHeader` — hiển thị greeting "Control Center" bằng font-serif display
- `Button` variant `primary` — Quick action "Tạo card mới" → `/create`
- `Badge` — hiển thị language/status trên mỗi entry gần đây
- `ProgressBar` — (tùy chọn) hiển thị tiến độ học hàng tuần

**Screen-specific components:**
- `StatCard` (`components/ui/StatCard.tsx`) — grid 4 cột: Total Vocabulary, Total Cards, Created Today, Success Rate
- `EntryListItem` (`components/history/EntryListItem.tsx`) — dòng 1 entry trong danh sách 10 từ gần đây

**State cần manage:**
- `stats`: `{ totalVocab: number; totalCards: number; todayCount: number }` — fetch từ Firestore
- `recentEntries`: `Entry[]` — 10 entries mới nhất

---

### Tạo card mới — `/create`

**Shared components:**
- `LoadingOverlay` — hiện khi đang generate (3 steps: Claude → TTS → Unsplash)
- `PageHeader` — breadcrumb: Home › Create Card › [Form type]
- `Button` variant `primary` — "Tạo nháp"
- `FormField` (Input/Textarea/Select) — tất cả form fields
- `Badge` variant `language` — hiển thị ngôn ngữ đang chọn
- `FlowTip` — gợi ý AI cho user

**Screen-specific components:**
- `DeckSelector` (`components/create/DeckSelector.tsx`) — dùng `Select` từ FormField
- `CategorySelector` (`components/create/CategorySelector.tsx`) — dùng `Select` từ FormField
- `LanguageSelector` (`components/create/LanguageSelector.tsx`) — 3 options với Badge
- `CardTypeSelector` (`components/create/CardTypeSelector.tsx`) — checkbox list + Toggle
- `TopicSelector` (`components/create/TopicSelector.tsx`) — chỉ form IT, Badge active/neutral
- `LanguageForm` / `ITForm` / `GeneralForm` — form tương ứng từng content type

**State cần manage:**
- `formType`: `FormType` — detect từ deck hoặc chọn thủ công
- `sessionState`: `SessionState` — load từ localStorage, auto-save on change
- `isGenerating`: `boolean` — điều khiển LoadingOverlay
- `generationSteps`: `Step[]` — trạng thái từng bước generate

---

### Preview & Review — `/preview`

**Shared components:**
- `PageHeader` — breadcrumb: Home › Create Card › Preview
- `Button` variant `primary` — "Xác nhận & Tạo"
- `Button` variant `ghost` — "Quay lại", "Tìm lại ảnh"
- `Modal` — confirm trước khi tạo Anki notes
- `Badge` — level, word type

**Screen-specific components:**
- `EditableField` (`components/preview/EditableField.tsx`) — click-to-edit với Input/Textarea
- `CollocationEditor` (`components/preview/CollocationEditor.tsx`) — dùng `Badge` + `@dnd-kit/core`
- `ImageSelector` (`components/preview/ImageSelector.tsx`) — grid 5 ảnh, selected ring-primary
- `AudioPlayer` (`components/preview/AudioPlayer.tsx`) — play/stop/regenerate
- `CardPreview` (`components/features/card/CardPreview.tsx`) — 3 tab front/back preview
- `CardList` (`components/preview/CardList.tsx`) — grid card types với Toggle

**State cần manage:**
- `previewData`: `Entry` — dữ liệu được generate từ Create page
- `selectedImage`: `UnsplashImage | null`
- `selectedCardTypes`: `string[]` — các card type đã chọn
- `confirmModalOpen`: `boolean`

---

### Lịch sử — `/history`

**Shared components:**
- `PageHeader` — title "Lịch sử từ vựng"
- `DataTable` — bảng chính (KHÔNG tạo table mới)
- `FilterBar` — search + filter + active filter badges
- `Badge` — trạng thái entry (active/inactive/pending)
- `Button` — actions trong mỗi row

**Screen-specific components:**
- `HistoryTable` (`components/history/HistoryTable.tsx`) — wrapper `DataTable` với columns cụ thể
- `WordDetailCard` (`components/features/history/WordDetailCard.tsx`) — trang chi tiết `/history/[id]`

**State cần manage:**
- `entries`: `Entry[]` — danh sách từ Firestore (có pagination)
- `searchQuery`: `string`
- `activeFilters`: `ActiveFilter[]` — category, language, deck, date range
- `currentPage`: `number`

---

### Quản lý (Admin) — `/admin`

**Shared components:**
- `PageHeader` — title "Control Center" với `actions` = nút "Thêm mới"
- `DataTable` — tất cả Manager component dùng chung (KHÔNG duplicate table logic)
- `Modal` — form Thêm/Sửa record
- `FormField` (Input/Select) — bên trong Modal
- `Toggle` — is_active, is_default switches
- `Badge` — trạng thái active/inactive
- `Button` variant `primary` — "Lưu", `ghost` — "Hủy", `destructive` — "Xóa"

**Screen-specific components:**
- `CategoryManager` (`components/admin/CategoryManager.tsx`)
- `CardTypeManager` (`components/admin/CardTypeManager.tsx`)
- `TopicManager` (`components/admin/TopicManager.tsx`)
- `DeckManager` (`components/admin/DeckManager.tsx`)
- `ContentTypeManager` (`components/admin/ContentTypeManager.tsx`)

**State cần manage:**
- `activeTab`: `'categories' | 'card-types' | 'topics' | 'decks' | 'content-types'`
- `modalOpen`: `boolean`
- `editingRecord`: `Category | CardTypeConfig | Topic | DeckConfig | null`
- `isLoading`: `boolean` — CRUD operations

---

### Cài đặt — `/settings`

**Shared components:**
- `PageHeader` — title "Settings" với description
- `FormField` (Input) — AnkiConnect URL
- `FormField` (Select) — Claude model
- `Toggle` — unsplash_enabled, tts_enabled
- `Button` variant `primary` — "Lưu thay đổi"
- `Button` variant `ghost` — "Test connection"

**Screen-specific components:**
- `IntegrationCard` (`components/features/settings/IntegrationCard.tsx`) — hiển thị từng API: AnkiConnect, Claude, Google TTS, Unsplash

**State cần manage:**
- `settings`: `Settings` — load từ Firestore `settings` collection
- `connectionStatus`: `Record<string, 'active' | 'inactive' | 'pending'>`
- `isSaving`: `boolean`

---

### Layout (Root) — `app/layout.tsx`

**Shared components:**
- `NavigationSidebar` — sidebar fixed w-64, bao gồm `AnkiFlowLogo` + nav items + `ConnectedBadge`
- `ConnectedBadge` — bottom sidebar, polling AnkiConnect mỗi 30s

**State cần manage:**
- `ankiConnected`: `boolean` — global state, poll từ `/api/anki/connect`

## 9. 🃏 Anki Card Templates — Thiết kế mới

### 9.1 Nguyên tắc thiết kế

1. **Nổi bật nội dung chính:** Từ vựng + nghĩa phải lớn, rõ ràng, dễ đọc nhất
2. **Phân cấp thị giác:** Dùng kích thước, màu sắc, khoảng cách để tạo hierarchy
3. **Bắt mắt, tạo hứng thú:** Gradient nhẹ, bo tròn, color accents
4. **Font an toàn:** Luôn có fallback cho CJK characters (Noto Sans SC, Noto Sans JP)
5. **Collocations rõ ràng:** Hiển thị cụm từ hay đi cùng để nhớ trong context

### 9.2 CSS chung cho tất cả Anki cards

```css
/* ============================================
   AnkiFlow Card Styles — v1.1
   Hỗ trợ: Tiếng Trung, Nhật, Anh, IT
   ============================================ */

/* Import Google Fonts — đảm bảo không lỗi font */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&display=swap');

/* === Biến CSS toàn cục === */
.card {
  --color-primary: #0061a4;       /* Primary */
  --color-primary-light: #2196f3;
  --color-accent: #f59e0b;        /* Amber */
  --color-bg: #f7f9fb;            /* Light background */
  --color-card-bg: #ffffff;       /* Surface lowest */
  --color-card-border: transparent; /* No-line rule */
  --color-text: #191c1e;          /* On surface */
  --color-text-muted: #515f74;    /* Secondary */
  --color-success: #006c49;       /* Tertiary */
  --color-han-viet: #8b5cf6;      /* Violet */
  --color-example: #0284c7;       /* Sky */
  --color-collocation: #ea580c;   /* Orange */
  --radius: 12px;
  --font-main: 'Inter', 'Noto Sans SC', 'Noto Sans JP', 'Noto Sans', 'Hiragino Sans', 'Microsoft YaHei', sans-serif;
}

/* === Base Card === */
.card {
  font-family: var(--font-main);
  background: var(--color-bg);
  color: var(--color-text);
  padding: 0;
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-container {
  background: var(--color-card-bg);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius);
  padding: 32px 28px;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 12px 32px rgba(25, 28, 30, 0.08);
}

/* === Từ vựng chính (nổi bật nhất) === */
.word-main {
  font-size: 56px;
  font-weight: 700;
  color: var(--color-text);
  text-align: center;
  margin-bottom: 8px;
  line-height: 1.2;
  letter-spacing: 2px;
}

/* === Phiên âm (Pinyin / Hiragana / IPA) === */
.reading {
  font-size: 20px;
  color: var(--color-primary-light);
  text-align: center;
  margin-bottom: 4px;
  font-weight: 500;
}

/* === Hán Việt === */
.han-viet {
  font-size: 15px;
  color: var(--color-han-viet);
  text-align: center;
  margin-bottom: 16px;
  font-style: italic;
}

/* === Nghĩa tiếng Việt (nổi bật thứ 2) === */
.meaning {
  font-size: 26px;
  font-weight: 600;
  color: var(--color-accent);
  text-align: center;
  margin: 16px 0;
  padding: 12px 16px;
  background: rgba(245, 158, 11, 0.1);
  border-radius: 12px;
  border-left: 4px solid var(--color-accent);
}

/* === Từ loại badge === */
.word-type {
  display: inline-block;
  padding: 3px 12px;
  background: rgba(99, 102, 241, 0.15);
  color: var(--color-primary-light);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  margin: 8px auto;
}

/* === Cấp độ badge === */
.level-badge {
  display: inline-block;
  padding: 3px 10px;
  background: rgba(16, 185, 129, 0.15);
  color: var(--color-success);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  margin-left: 8px;
}

/* === Đường ngăn cách === */
.divider {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-card-border), transparent);
  margin: 20px 0;
}

/* === Hình ảnh === */
.image-container {
  text-align: center;
  margin: 16px 0;
}

.image-container img {
  max-width: 220px;
  max-height: 180px;
  border-radius: 12px;
  object-fit: cover;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* === Câu ví dụ === */
.example-box {
  background: rgba(56, 189, 248, 0.08);
  border-radius: 12px;
  padding: 14px 16px;
  margin: 16px 0;
  border-left: 3px solid var(--color-example);
}

.example-sentence {
  font-size: 17px;
  color: var(--color-text);
  line-height: 1.6;
  margin-bottom: 6px;
}

.example-translation {
  font-size: 14px;
  color: var(--color-text-muted);
  font-style: italic;
}

.example-audio {
  margin-top: 8px;
}

/* === Cụm từ hay đi cùng (Collocations) === */
.collocations-box {
  background: rgba(251, 146, 60, 0.08);
  border-radius: 12px;
  padding: 14px 16px;
  margin: 16px 0;
  border-left: 3px solid var(--color-collocation);
}

.collocations-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-collocation);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.collocation-item {
  font-size: 15px;
  color: var(--color-text);
  line-height: 1.8;
  padding-left: 8px;
}

.collocation-item::before {
  content: "•";
  color: var(--color-collocation);
  margin-right: 8px;
  font-weight: bold;
}

/* === Audio button === */
.audio-section {
  text-align: center;
  margin: 12px 0;
}

/* === Prompt/Hint text === */
.hint-text {
  font-size: 15px;
  color: var(--color-text-muted);
  text-align: center;
  font-style: italic;
  margin: 20px 0;
}

/* === IT Card specific === */
.term-main {
  font-size: 36px;
  font-weight: 700;
  color: var(--color-text);
  text-align: center;
  margin-bottom: 8px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.topic-badge {
  display: inline-block;
  padding: 4px 14px;
  background: rgba(99, 102, 241, 0.15);
  color: var(--color-primary-light);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  margin: 4px;
}

.definition {
  font-size: 18px;
  color: var(--color-text);
  line-height: 1.6;
  text-align: left;
  padding: 16px;
  background: rgba(99, 102, 241, 0.06);
  border-radius: 12px;
  margin: 16px 0;
}

.keywords-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin: 12px 0;
}

.keyword-tag {
  display: inline-block;
  padding: 3px 10px;
  background: rgba(148, 163, 184, 0.15);
  color: var(--color-text-muted);
  border-radius: 6px;
  font-size: 12px;
}

.analogy-box {
  background: rgba(245, 158, 11, 0.08);
  border-radius: 12px;
  padding: 14px 16px;
  margin: 16px 0;
  font-size: 15px;
  color: var(--color-text);
  border-left: 3px solid var(--color-accent);
  font-style: italic;
}
```

### 9.3 Template: Ngôn ngữ — Từ → Nghĩa

**Front:**
```html
<div class="card-container">
  <div class="word-main">{{Word}}</div>
  <div class="reading">{{Pinyin}}</div>
  {{#HanViet}}<div class="han-viet">HV: {{HanViet}}</div>{{/HanViet}}
  <div class="audio-section">{{Audio}}</div>
  <div>
    <span class="word-type">{{WordType}}</span>
    {{#Level}}<span class="level-badge">{{Level}}</span>{{/Level}}
  </div>
</div>
```

**Back:**
```html
<div class="card-container">
  <div class="word-main">{{Word}}</div>
  <div class="reading">{{Pinyin}}</div>
  {{#HanViet}}<div class="han-viet">HV: {{HanViet}}</div>{{/HanViet}}
  <div class="audio-section">{{Audio}}</div>

  <hr class="divider">

  {{#Image}}<div class="image-container">{{Image}}</div>{{/Image}}

  <div class="meaning">{{MeaningVI}}</div>

  {{#ExampleSentence}}
  <div class="example-box">
    <div class="example-sentence">{{ExampleSentence}}</div>
    <div class="example-audio">{{ExampleAudio}}</div>
    <div class="example-translation">{{ExampleTranslation}}</div>
  </div>
  {{/ExampleSentence}}

  {{#Collocations}}
  <div class="collocations-box">
    <div class="collocations-title">Cụm từ hay đi cùng</div>
    {{Collocations}}
  </div>
  {{/Collocations}}
</div>
```

### 9.4 Template: Ngôn ngữ — Nghĩa → Từ

**Front:**
```html
<div class="card-container">
  <div class="meaning">{{MeaningVI}}</div>
  {{#Image}}<div class="image-container">{{Image}}</div>{{/Image}}
  <div class="hint-text">Từ này là gì?</div>
</div>
```

**Back:**
```html
<div class="card-container">
  <div class="word-main">{{Word}}</div>
  <div class="reading">{{Pinyin}}</div>
  {{#HanViet}}<div class="han-viet">HV: {{HanViet}}</div>{{/HanViet}}
  <div class="audio-section">{{Audio}}</div>

  <hr class="divider">

  <div class="meaning">{{MeaningVI}}</div>

  {{#ExampleSentence}}
  <div class="example-box">
    <div class="example-sentence">{{ExampleSentence}}</div>
    <div class="example-audio">{{ExampleAudio}}</div>
    <div class="example-translation">{{ExampleTranslation}}</div>
  </div>
  {{/ExampleSentence}}

  {{#Collocations}}
  <div class="collocations-box">
    <div class="collocations-title">Cụm từ hay đi cùng</div>
    {{Collocations}}
  </div>
  {{/Collocations}}
</div>
```

### 9.5 Template: Nghe → Đoán từ

**Front:**
```html
<div class="card-container">
  <div class="audio-section" style="margin: 40px 0;">
    <div style="font-size: 64px; margin-bottom: 20px;">🔊</div>
    {{Audio}}
  </div>
  <div class="hint-text">Nghe và đoán từ...</div>
</div>
```

**Back:**
```html
<div class="card-container">
  <div class="word-main">{{Word}}</div>
  <div class="reading">{{Pinyin}}</div>
  {{#HanViet}}<div class="han-viet">HV: {{HanViet}}</div>{{/HanViet}}
  <div class="audio-section">{{Audio}}</div>

  <hr class="divider">

  {{#Image}}<div class="image-container">{{Image}}</div>{{/Image}}
  <div class="meaning">{{MeaningVI}}</div>

  {{#ExampleSentence}}
  <div class="example-box">
    <div class="example-sentence">{{ExampleSentence}}</div>
    <div class="example-translation">{{ExampleTranslation}}</div>
  </div>
  {{/ExampleSentence}}

  {{#Collocations}}
  <div class="collocations-box">
    <div class="collocations-title">Cụm từ hay đi cùng</div>
    {{Collocations}}
  </div>
  {{/Collocations}}
</div>
```

### 9.6 Template: Nhìn ảnh → Đoán từ

**Front:**
```html
<div class="card-container">
  <div class="image-container" style="margin: 20px 0;">{{Image}}</div>
  <div class="hint-text">Từ nào mô tả hình ảnh này?</div>
</div>
```

**Back:**
```html
<div class="card-container">
  <div class="image-container">{{Image}}</div>

  <hr class="divider">

  <div class="word-main">{{Word}}</div>
  <div class="reading">{{Pinyin}}</div>
  {{#HanViet}}<div class="han-viet">HV: {{HanViet}}</div>{{/HanViet}}
  <div class="audio-section">{{Audio}}</div>
  <div class="meaning">{{MeaningVI}}</div>
</div>
```

### 9.7 Template: Điền vào chỗ trống

**Front:**
```html
<div class="card-container">
  <div class="example-box" style="border-left-color: var(--color-primary);">
    <div class="example-sentence" style="font-size: 22px;">{{ExampleBlank}}</div>
  </div>
  <div class="example-translation" style="text-align: center; margin-top: 12px;">
    {{ExampleTranslation}}
  </div>
  <div class="hint-text">Điền từ còn thiếu...</div>
</div>
```

**Back:**
```html
<div class="card-container">
  <div class="word-main">{{Word}}</div>
  <div class="reading">{{Pinyin}}</div>
  {{#HanViet}}<div class="han-viet">HV: {{HanViet}}</div>{{/HanViet}}
  <div class="audio-section">{{Audio}}</div>

  <hr class="divider">

  <div class="example-box">
    <div class="example-sentence">{{ExampleSentence}}</div>
    <div class="example-audio">{{ExampleAudio}}</div>
    <div class="example-translation">{{ExampleTranslation}}</div>
  </div>

  <div class="meaning">{{MeaningVI}}</div>
</div>
```

### 9.8 Template: Pinyin/Hiragana → Chữ gốc

**Front:**
```html
<div class="card-container">
  <div class="reading" style="font-size: 36px; margin: 20px 0;">{{Pinyin}}</div>
  <div class="meaning" style="font-size: 18px;">{{MeaningVI}}</div>
  <div class="hint-text">Viết bằng chữ Hán/Kanji...</div>
</div>
```

**Back:**
```html
<div class="card-container">
  <div class="word-main">{{Word}}</div>
  <div class="reading">{{Pinyin}}</div>
  {{#HanViet}}<div class="han-viet">HV: {{HanViet}}</div>{{/HanViet}}
  <div class="audio-section">{{Audio}}</div>

  <hr class="divider">

  <div class="meaning">{{MeaningVI}}</div>

  {{#Collocations}}
  <div class="collocations-box">
    <div class="collocations-title">Cụm từ hay đi cùng</div>
    {{Collocations}}
  </div>
  {{/Collocations}}
</div>
```

### 9.9 Template: IT — Khái niệm → Định nghĩa

**Front:**
```html
<div class="card-container">
  <div class="term-main">{{Term}}</div>
  <div style="text-align: center; margin: 12px 0;">
    {{#Topic}}<span class="topic-badge">{{Topic}}</span>{{/Topic}}
  </div>
</div>
```

**Back:**
```html
<div class="card-container">
  <div class="term-main">{{Term}}</div>
  <div style="text-align: center;">
    {{#Topic}}<span class="topic-badge">{{Topic}}</span>{{/Topic}}
  </div>

  <hr class="divider">

  {{#Image}}<div class="image-container">{{Image}}</div>{{/Image}}

  <div class="definition">{{Definition}}</div>

  {{#Analogy}}
  <div class="analogy-box">
    💡 {{Analogy}}
  </div>
  {{/Analogy}}

  {{#ExampleUsage}}
  <div class="example-box">
    <div class="example-sentence">{{ExampleUsage}}</div>
  </div>
  {{/ExampleUsage}}

  <div class="keywords-list">
    {{#Keywords}}<span class="keyword-tag">{{Keywords}}</span>{{/Keywords}}
  </div>
</div>
```

### 9.10 Template: IT — Định nghĩa → Khái niệm

**Front:**
```html
<div class="card-container">
  <div class="definition">{{DefinitionShort}}</div>
  {{#Topic}}<div style="text-align: center;"><span class="topic-badge">{{Topic}}</span></div>{{/Topic}}
  <div class="hint-text">Thuật ngữ nào?</div>
</div>
```

**Back:**
```html
<div class="card-container">
  <div class="term-main">{{Term}}</div>

  <hr class="divider">

  <div class="definition">{{Definition}}</div>

  {{#Analogy}}
  <div class="analogy-box">
    💡 {{Analogy}}
  </div>
  {{/Analogy}}
</div>
```

---

## 10. 🤖 AI Prompt Specifications — Cập nhật v1.1

### 10.1 Prompt cho Tiếng Trung

```
Bạn là chuyên gia ngôn ngữ Tiếng Trung dạy cho người Việt Nam.
Với từ "{{WORD}}", hãy cung cấp thông tin theo format JSON sau.

YÊU CẦU QUAN TRỌNG:
- Câu ví dụ phải NGẮN GỌN (dưới 10 từ), dễ hiểu, ngữ pháp đúng, ngôn ngữ tự nhiên đời sống hàng ngày.
- Collocations: cung cấp 3-5 cụm từ/lượng từ hay đi cùng, kèm nghĩa tiếng Việt.
  Ví dụ với 醋: "蘸点儿醋 (chấm chút giấm)", "白醋 (giấm trắng)", "吃醋 (ghen tuông)"
- Với danh từ: thêm lượng từ phù hợp. Ví dụ: 一本书, 一杯水

{
  "word": "书",
  "pinyin": "shū",
  "han_viet": "Thư",
  "meaning_vi": "quyển sách, cuốn sách",
  "word_type": "名词",
  "word_type_vi": "danh từ",
  "level": "HSK1",
  "example_sentence": "我喜欢看书。",
  "example_translation": "Tôi thích đọc sách.",
  "example_blank": "我喜欢看___。",
  "collocations": [
    "看书 (đọc sách)",
    "一本书 (một cuốn sách)",
    "书店 (hiệu sách)",
    "买书 (mua sách)"
  ],
  "related_words": ["图书馆", "书包", "书店"],
  "unsplash_search_keyword": "book reading"
}
```

### 10.2 Prompt cho Tiếng Nhật

```
Bạn là chuyên gia ngôn ngữ Tiếng Nhật dạy cho người Việt Nam.
Với từ "{{WORD}}", hãy cung cấp thông tin theo format JSON sau.

YÊU CẦU QUAN TRỌNG:
- Câu ví dụ phải NGẮN GỌN (dưới 10 từ), dễ hiểu, ngữ pháp đúng, ngôn ngữ tự nhiên.
- Collocations: cung cấp 3-5 cụm từ/trợ từ hay đi cùng, kèm nghĩa TV.
  Ví dụ với 本: "本を読む (đọc sách)", "一冊の本 (một quyển sách)"
- Katakana nếu từ có nguồn gốc ngoại lai.

{
  "word": "本",
  "hiragana": "ほん",
  "katakana": "",
  "romaji": "hon",
  "meaning_vi": "cuốn sách, quyển sách",
  "word_type_vi": "danh từ",
  "level": "N5",
  "example_sentence": "これは本です。",
  "example_translation": "Đây là cuốn sách.",
  "example_blank": "これは___です。",
  "collocations": [
    "本を読む (đọc sách)",
    "一冊の本 (một quyển sách)",
    "本屋 (hiệu sách)",
    "教科書 (sách giáo khoa)"
  ],
  "related_words": ["図書館", "本屋", "読書"],
  "unsplash_search_keyword": "book"
}
```

### 10.3 Prompt cho Tiếng Anh

```
Bạn là chuyên gia ngôn ngữ Tiếng Anh dạy cho người Việt Nam.
Với từ "{{WORD}}", hãy cung cấp thông tin theo format JSON.

YÊU CẦU QUAN TRỌNG:
- Câu ví dụ phải NGẮN GỌN (dưới 12 từ), dễ hiểu, tự nhiên.
- Collocations: 3-5 cụm từ/collocation phổ biến, kèm nghĩa TV.
  Ví dụ với "book": "book a flight (đặt vé máy bay)", "read a book (đọc sách)"

{
  "word": "book",
  "ipa": "/bʊk/",
  "meaning_vi": "quyển sách, cuốn sách; đặt chỗ trước",
  "word_type_vi": "danh từ / động từ",
  "example_sentence": "I love reading books.",
  "example_translation": "Tôi thích đọc sách.",
  "example_blank": "I love reading ___.",
  "collocations": [
    "read a book (đọc sách)",
    "book a flight (đặt vé máy bay)",
    "book a table (đặt bàn)",
    "a good book (một cuốn sách hay)"
  ],
  "unsplash_search_keyword": "reading book"
}
```

### 10.4 Prompt cho IT Vocabulary

```
Bạn là chuyên gia IT giải thích cho lập trình viên Việt Nam.
Với thuật ngữ "{{TERM}}" trong lĩnh vực "{{TOPICS}}", hãy cung cấp:

YÊU CẦU:
- definition_vi: giải thích đầy đủ nhưng rõ ràng, dễ hiểu
- definition_short: 1 câu siêu ngắn gọn
- analogy_vi: ví von bằng đời thường để dễ nhớ
- example_usage: ví dụ thực tế, ngắn gọn

{
  "term": "API",
  "definition_vi": "Giao diện lập trình ứng dụng — tập hợp các quy tắc cho phép các phần mềm giao tiếp với nhau.",
  "definition_short": "Cầu nối giữa các phần mềm",
  "example_usage": "Frontend gọi REST API để lấy dữ liệu từ server.",
  "keywords": ["REST", "HTTP", "endpoint", "request", "response"],
  "related_topics": ["Web Development", "Backend", "Integration"],
  "analogy_vi": "API giống như menu nhà hàng — bạn chọn món (request) và bếp làm (server xử lý).",
  "unsplash_search_keyword": "programming code"
}
```

---

## 11. 🔌 API Integration Specifications

### 11.1 AnkiConnect API

**Base URL:** `http://localhost:8765`  
**Phiên bản action:** 6

**Tạo Note mới:**
```typescript
POST http://localhost:8765
{
  "action": "addNote",
  "version": 6,
  "params": {
    "note": {
      "deckName": "Language::Chinese::HSK1",
      "modelName": "AnkiFlow-Language-Chinese",
      "fields": {
        "Word": "书",
        "Pinyin": "shū",
        "HanViet": "Thư",
        "MeaningVI": "quyển sách",
        "WordType": "danh từ",
        "Level": "HSK1",
        "ExampleSentence": "我喜欢看书。",
        "ExampleTranslation": "Tôi thích đọc sách.",
        "ExampleBlank": "我喜欢看___。",
        "Collocations": "• 看书 (đọc sách)<br>• 一本书 (một cuốn sách)<br>• 书店 (hiệu sách)",
        "Image": "<img src='shu_book_abc123.jpg'>",
        "Audio": "[sound:shu_abc123.mp3]",
        "ExampleAudio": "[sound:example_shu_abc123.mp3]"
      },
      "tags": ["hsk1", "noun", "daily"],
      "options": { "allowDuplicate": false }
    }
  }
}
```

**Kiểm tra kết nối:**
```typescript
POST http://localhost:8765
{ "action": "version", "version": 6 }
```

**Store media file:**
```typescript
POST http://localhost:8765
{
  "action": "storeMediaFile",
  "version": 6,
  "params": {
    "filename": "shu_abc123.mp3",
    "data": "<base64-encoded-audio>"
  }
}
```

### 11.2 Claude API (AI Agent)

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// AI agent: ép model gọi tool `submit_card` → structured output đúng schema
const res = await client.messages.create({
  model: "claude-haiku-4-5", // lấy từ settings.ai_model
  max_tokens: 4096,
  temperature: 0.3,
  system: systemPrompt,
  tools: [{ name: "submit_card", description, input_schema: cardInputSchema }],
  tool_choice: { type: "tool", name: "submit_card" },
  messages: [{ role: "user", content: userMessage }],
});

const toolUse = res.content.find((b) => b.type === "tool_use");
const content = cardSchema.parse(toolUse.input); // validate bằng zod
```

### 11.3 Google Cloud TTS

// Quan trọng: Tách generate và store thành 2 bước độc lập.
// Xem /api/audio/generate và /api/audio/store.
// Route /api/audio vẫn giữ cho backward-compatible.

```typescript
import textToSpeech from "@google-cloud/text-to-speech";

const client = new textToSpeech.TextToSpeechClient();

// Tiếng Trung
const request = {
  input: { text: "书" },
  voice: { languageCode: "zh-CN", name: "zh-CN-Wavenet-A" },
  audioConfig: { audioEncoding: "MP3" }
};

// Tiếng Nhật: { languageCode: "ja-JP", name: "ja-JP-Wavenet-A" }
// Tiếng Anh: { languageCode: "en-US", name: "en-US-Wavenet-F" }
```

### 11.4 Unsplash API

```typescript
const response = await fetch(
  `https://api.unsplash.com/search/photos?query=${keyword}&per_page=5&orientation=squarish`,
  { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }
);
```

---

## 12. 📁 Cấu trúc project — Cập nhật

```
ankiflow/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Dashboard
│   ├── create/
│   │   └── page.tsx              # Create card form
│   ├── preview/
│   │   └── page.tsx              # Preview & review
│   ├── history/
│   │   ├── page.tsx              # History list
│   │   └── [id]/page.tsx         # Entry detail
│   ├── admin/                    # MỚI: Trang quản lý
│   │   └── page.tsx              # CRUD categories, topics, card types, decks, content types
│   ├── settings/
│   │   └── page.tsx              # Settings
│   └── api/
│       ├── generate/route.ts     # Gọi Claude API (AI agent)
│       ├── audio/route.ts        # Gọi Google TTS
│       ├── image/route.ts        # Gọi Unsplash API
│       ├── anki/
│       │   ├── connect/route.ts  # Kiểm tra AnkiConnect
│       │   ├── create/route.ts   # Tạo notes
│       │   └── decks/route.ts    # Lấy decks
│       ├── history/
│       │   ├── route.ts          # CRUD entries
│       │   └── [id]/route.ts
│       └── admin/                # MỚI: API quản lý
│           ├── categories/route.ts
│           ├── card-types/route.ts
│           ├── topics/route.ts
│           ├── decks/route.ts
│           └── content-types/route.ts
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── StatusBar.tsx
│   ├── create/
│   │   ├── CategorySelector.tsx  # Dropdown từ DB categories
│   │   ├── LanguageSelector.tsx
│   │   ├── DeckSelector.tsx      # Dropdown, auto-detect form type
│   │   ├── CardTypeSelector.tsx  # Checkbox list từ DB card_types
│   │   ├── TopicSelector.tsx     # MỚI: Checkbox list cho IT topics
│   │   ├── LanguageForm.tsx
│   │   ├── ITForm.tsx
│   │   └── GeneralForm.tsx
│   ├── preview/
│   │   ├── CardPreview.tsx
│   │   ├── CardList.tsx
│   │   ├── EditableField.tsx
│   │   ├── ImageSelector.tsx
│   │   └── AudioPlayer.tsx
│   ├── history/
│   │   ├── HistoryTable.tsx
│   │   └── FilterBar.tsx
│   └── admin/                    # MỚI
│       ├── CategoryManager.tsx
│       ├── CardTypeManager.tsx
│       ├── TopicManager.tsx
│       ├── DeckManager.tsx
│       └── ContentTypeManager.tsx
│
├── lib/
│   ├── firebase.ts
│   ├── ai-agent/                # MỚI: Claude AI agent (provider + schemas)
│   ├── tts.ts
│   ├── unsplash.ts
│   ├── anki-connect.ts
│   ├── session.ts               # MỚI: Session persistence logic
│   └── prompts/
│       ├── chinese.ts
│       ├── japanese.ts
│       ├── english.ts
│       └── it-vocab.ts
│
├── hooks/                        # MỚI
│   ├── useSession.ts             # Hook quản lý session state
│   ├── useAnkiConnection.ts
│   └── useFirestore.ts
│
├── types/
│   └── index.ts
│
├── styles/
│   └── anki-cards/
│       ├── base.css              # CSS chung cho Anki cards
│       ├── language.css
│       └── it.css
│
├── .env.local
├── .env.example
└── README.md
```

---

## 13. 🔑 Biến môi trường

```bash
# .env.local

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Anthropic Claude
ANTHROPIC_API_KEY=

# Google Cloud TTS
GOOGLE_APPLICATION_CREDENTIALS=./gcp-service-account.json

# Unsplash
UNSPLASH_ACCESS_KEY=

# AnkiConnect
ANKI_CONNECT_URL=http://localhost:8765
```

---

## 14. 💰 Phân tích chi phí

| Dịch vụ | Free Tier | Dự kiến dùng | Chi phí |
|---|---|---|---|
| **Firebase Firestore** | 1GB storage, 50K reads/ngày, 20K writes/ngày | ~300MB (300K cards + config) | $0 |
| **Firebase Storage** | 5GB | Gần như không dùng | $0 |
| **Claude Haiku 4.5** | Trả phí (~$1/$5 per 1M tokens in/out) | ~1 call/thẻ (~1-2K tokens) | ~vài cent / 100 thẻ |
| **Google Cloud TTS** | 1M ký tự/tháng (WaveNet) | ~100-500 ký tự/card | $0 |
| **Unsplash API** | 50 requests/giờ (Demo) | 1 request/card | $0 |
| **AnkiConnect** | Miễn phí, open-source | - | $0 |
| **AnkiWeb sync** | Miễn phí | - | $0 |
| **Hosting** | Localhost | - | $0 |
| **Tổng** | | | **~$0/tháng + phí Claude theo token (rất nhỏ)** |

> **Lưu ý:** Nếu số card vượt 400K+, chi phí Firestore storage có thể phát sinh ~$0.07-$0.18/tháng.

---

## 15. 🚧 Giới hạn & Rủi ro

| Rủi ro | Mức độ | Giải pháp |
|---|---|---|
| AnkiConnect không phản hồi | Cao | Hiển thị hướng dẫn bật Anki, retry mechanism |
| Claude trả output sai schema | Thấp | Tool `submit_card` ép schema + validate zod + retry |
| Unsplash không tìm được ảnh phù hợp | Trung bình | Cho phép nhập từ khóa khác, bỏ qua ảnh |
| Google TTS rate limit | Thấp | Queue, retry với delay |
| Firestore offline | Thấp | Cache local, sync sau |
| Trùng từ đã tạo | Trung bình | Kiểm tra trong Firestore trước khi tạo |
| Lỗi font CJK trên Anki mobile | Trung bình | Dùng Google Fonts (Noto Sans SC/JP) với fallback chain |
| Google TTS rate limit / lãng phí quota | Đã giảm thiểu | Tách route generate/store — có thể retry store mà không tốn TTS quota |


---

## 16. 🛣️ Roadmap

### Phase 1 — MVP (Dự án hiện tại)
- [x] Thiết kế PRD
- [ ] Setup project (Next.js + Firebase + API keys)
- [ ] Tạo Anki Note Types/Templates
- [ ] Admin page: CRUD categories, topics, card types, decks
- [ ] Create form + Session persistence
- [ ] Preview & Review + Confirm
- [ ] Tích hợp Claude API — AI agent tool-based (với collocations)
- [ ] Tích hợp Google TTS
- [ ] Tích hợp Unsplash
- [ ] Tích hợp AnkiConnect
- [ ] Lưu lịch sử vào Firestore
- [ ] Dashboard + History view

### Phase 2 — Cải tiến
- [ ] Batch import (nhiều từ cùng lúc từ file CSV/txt)
- [ ] Review/chỉnh sửa entry đã tạo
- [ ] Thống kê học tập (card nào đang ôn, tiến độ)
- [ ] Template editor trực quan (tùy chỉnh card design)
- [ ] Export/import data
- [ ] Content type editor nâng cao (drag & drop fields)

### Phase 3 — Mở rộng (Tương lai)
- [ ] App iOS/Android cá nhân (thay thế Anki)
- [ ] Sync trực tiếp không cần AnkiWeb
- [ ] AI gợi ý từ cần học tiếp theo
- [ ] Tích hợp với Obsidian/Notion

---

## 17. ✅ Tiêu chí hoàn thành MVP

- [ ] Tạo được card Tiếng Trung với đầy đủ: Hán tự, Pinyin, Hán Việt, nghĩa VN, ví dụ ngắn gọn, collocations, audio, ảnh
- [ ] Tạo được card Tiếng Nhật với: Kanji, Hiragana, Romaji, nghĩa VN, ví dụ, collocations, audio, ảnh  
- [ ] Tạo được card Tiếng Anh với: từ, IPA, nghĩa VN, ví dụ, collocations, audio, ảnh
- [ ] Tạo được card IT Vocabulary với: thuật ngữ, định nghĩa, analogy, keywords, ảnh
- [ ] Review trước khi tạo, có thể chỉnh sửa từng field
- [ ] Card hiển thị đẹp, bắt mắt, không lỗi font trên mọi thiết bị
- [ ] Session persistence: chỉ cần nhập từ mới, không cần chọn lại field cố định
- [ ] Trang Admin: quản lý categories, topics, card types, decks
- [ ] Card xuất hiện đúng trong Anki Desktop
- [ ] Có thể học trên iPad sau khi sync
- [ ] Lịch sử được lưu trong Firestore
- [ ] Chi phí $0/tháng
