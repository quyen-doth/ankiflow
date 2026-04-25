
# ✅ Task List — AnkiFlow Project

**Dự án:** AnkiFlow — Personal Flashcard Automation  
**Cập nhật lần cuối:** 2026-04-18 (v1.1 — đã bổ sung feedback)

---

## 📌 Ghi chú ký hiệu
- `[ ]` Chưa làm
- `[/]` Đang làm
- `[x]` Hoàn thành
- ⚠️ Cần chú ý đặc biệt
- 🔑 Cần API key / credential
- 🆕 Task mới (thêm từ feedback v1.1)

---

## PHASE 0 — Chuẩn bị & Setup (Làm trước tiên)

### 0.1 Lấy API Keys & Credentials 🔑

- [ ] **Gemini API Key**
  - Vào [aistudio.google.com](https://aistudio.google.com)
  - Tạo API Key miễn phí
  - Lưu vào `.env.local`

- [ ] **Firebase Project Setup**
  - Tạo project mới tại [console.firebase.google.com](https://console.firebase.google.com)
  - Enable Firestore Database (mode: production)
  - Tạo Web App → lấy Firebase config
  - Lưu tất cả config vào `.env.local`
  - Setup Firestore Security Rules (chỉ đọc/ghi từ localhost)

- [ ] **Google Cloud TTS**
  - Vào [console.cloud.google.com](https://console.cloud.google.com)
  - Enable API: "Cloud Text-to-Speech API"
  - Tạo Service Account → Download JSON key
  - Lưu file JSON vào root project (gitignore)

- [ ] **Unsplash API**
  - Đăng ký tại [unsplash.com/developers](https://unsplash.com/developers)
  - Tạo application → lấy Access Key
  - Lưu vào `.env.local`

---

### 0.2 Setup Anki

- [ ] **Cài đặt AnkiConnect plugin**
  - Mở Anki Desktop
  - Tools → Add-ons → Get Add-ons
  - Nhập code: `2055492159`
  - Restart Anki
  - Kiểm tra: `http://localhost:8765` → thấy response OK

- [ ] **Tạo cấu trúc Deck trong Anki**
  - `Language::Chinese::HSK1`
  - `Language::Chinese::HSK2`
  - `Language::Japanese::N5`
  - `Language::Japanese::N4`
  - `Language::English::B1`
  - `Vocabulary::IT`
  - `Vocabulary::General`

- [ ] **Tạo Note Types (Model) trong Anki** ⚠️
  - Model 1: `AnkiFlow-Language-Chinese`
    - Fields: Word, Pinyin, HanViet, MeaningVI, WordType, Level, ExampleSentence, ExampleTranslation, ExampleBlank, ExampleAudio, **Collocations**, Image, Audio
  - Model 2: `AnkiFlow-Language-Japanese`  
    - Fields: Word, Hiragana, **Katakana**, Romaji, MeaningVI, WordType, Level, ExampleSentence, ExampleTranslation, ExampleBlank, ExampleAudio, **Collocations**, Image, Audio
  - Model 3: `AnkiFlow-Language-English`
    - Fields: Word, IPA, MeaningVI, WordType, ExampleSentence, ExampleTranslation, ExampleBlank, ExampleAudio, **Collocations**, Image, Audio
  - Model 4: `AnkiFlow-IT-Vocabulary`
    - Fields: Term, Definition, DefinitionShort, Keywords, Topic, ExampleUsage, **Analogy**, Image
  - Model 5: `AnkiFlow-General`
    - Fields: Title, Content, Image

- [ ] **Setup Card Templates trong Anki** (Front/Back HTML + CSS theo PRD mục 9)
  - Áp CSS base mới (light mode, no-line rule, font safety)
  - Chinese: 7 card types
  - Japanese: 7 card types
  - English: 5 card types
  - IT: 2 card types
  - General: 1 card type

---

### 0.3 Setup Project Next.js

- [ ] **Khởi tạo project**
  ```bash
  npx create-next-app@latest ankiflow \
    --typescript --tailwind --eslint --app \
    --src-dir=false --import-alias="@/*"
  ```

- [ ] **Cài dependencies**
  ```bash
  pnpm add firebase @google/generative-ai \
    @google-cloud/text-to-speech \
    lucide-react clsx
  pnpm add -D @types/node
  ```

- [ ] **Tạo file cấu hình**
  - `.env.local` (từ `.env.example`)
  - `.gitignore` (thêm: `.env.local`, `gcp-service-account.json`, `.next`)

- [ ] **Setup Firebase trong code**
  - Tạo `lib/firebase.ts`
  - Init Firestore client

- [ ] **Tạo cấu trúc thư mục** theo PRD section 12

- [ ] **Kiểm tra project chạy được**
  ```bash
  pnpm dev
  # Mở http://localhost:3000 → thấy Next.js default page
  ```

---

### 0.4 Seed Data cho Firestore 🆕

- [ ] **Tạo script seed: `scripts/seed-firestore.ts`**
  - Chạy 1 lần để khởi tạo dữ liệu mặc định

- [ ] **Seed collection `categories`**
  - Language: Đời sống, Kinh doanh, Du lịch, Ẩm thực, Công nghệ, Giáo dục, Y tế, Văn hóa

- [ ] **Seed collection `card_types`**
  - Language (chung): word_to_meaning, meaning_to_word, audio_to_word, image_to_word, fill_in_blank
  - Language (Chinese only): reading_to_word, word_to_reading
  - Language (Japanese only): reading_to_word, word_to_reading
  - IT: concept_to_def, def_to_concept

- [ ] **Seed collection `topics`**
  - Database, Frontend, Backend, Algorithm, DevOps, Security, Architecture, Network, OS, Data Science

- [ ] **Seed collection `decks`** (với mapping → form type)
  - Mapping: mỗi deck → form_type + language + default card types + default category

- [ ] **Seed collection `content_types`** (form config)
  - Language: field list + session rules
  - IT: field list + session rules
  - General: field list + session rules

- [ ] **Seed collection `settings`**
  - Giá trị mặc định: anki_connect_url, gemini_model...

---

## PHASE 1 — Backend API Routes

### 1.1 TypeScript Types ✅

- [x] **Tạo `types/index.ts`**
  - Định nghĩa tất cả interfaces: Entry, Category, CardTypeConfig, Topic, DeckConfig, ContentType, FormFieldConfig, SessionState
  - Định nghĩa enums: FormType, LanguageType

### 1.2 Route: AnkiConnect

- [x] **Tạo `lib/anki-connect.ts`**
  - Function: `checkConnection()` → boolean
  - Function: `getDecks()` → string[]
  - Function: `createNote(note)` → noteId
  - Function: `storeMediaFile(filename, base64)` → boolean
  - Function: `addNotes(notes[])` → number[]

- [x] **Tạo `app/api/anki/connect/route.ts`**
  - GET: ping AnkiConnect, trả về version + status

- [x] **Tạo `app/api/anki/decks/route.ts`**
  - GET: lấy danh sách decks từ AnkiConnect

- [x] **Tạo `app/api/anki/create/route.ts`**
  - POST: tạo notes trong Anki, lưu IDs vào Firestore

### 1.3 Route: Generate nội dung (AI)

- [x] **Tạo `lib/prompts/chinese.ts`** — Prompt v1.1 (có collocations)
- [x] **Tạo `lib/prompts/japanese.ts`** — Prompt v1.1 (có collocations)
- [x] **Tạo `lib/prompts/english.ts`** — Prompt v1.1 (có collocations)
- [x] **Tạo `lib/prompts/it-vocab.ts`** — Prompt v1.1 (có analogy)

- [x] **Tạo `lib/gemini.ts`**
  - Function: `generateCardContent(prompt): Promise<CardContent>`
  - JSON parse + validation + retry

- [x] **Tạo `app/api/generate/route.ts`**
  - POST: `{ word, form_type, language?, topics? }`

### 1.4 Route: Audio (TTS)

- [x] **Tạo `lib/tts.ts`**
  - Function: `generateAudio(text, language): Promise<Buffer>`
  - Language → Voice mapping

- [x] **Tạo `app/api/audio/route.ts`**
  - POST: `{ text, language, filename }`
  - TTS → base64 → AnkiConnect storeMediaFile

### 1.5 Route: Images (Unsplash)

- [x] **Tạo `lib/unsplash.ts`**
  - Function: `searchImages(keyword, count?): Promise<UnsplashImage[]>`

- [x] **Tạo `app/api/image/route.ts`**
  - GET: `?keyword=book&count=5`

### 1.6 Route: History (Entries)

- [x] **Tạo `app/api/history/route.ts`**
  - GET: list entries (filter, pagination)
  - POST: create entry

- [x] **Tạo `app/api/history/[id]/route.ts`**
  - GET / PUT / DELETE

### 1.7 Route: Admin CRUD 🆕

- [x] **Tạo `app/api/admin/categories/route.ts`**
  - GET: list categories (filter by form_type)
  - POST: create category
  - PUT: update category
  - DELETE: toggle is_active

- [x] **Tạo `app/api/admin/card-types/route.ts`**
  - GET / POST / PUT / DELETE

- [x] **Tạo `app/api/admin/topics/route.ts`**
  - GET / POST / PUT / DELETE

- [x] **Tạo `app/api/admin/decks/route.ts`**
  - GET / POST / PUT / DELETE
  - Bao gồm: mapping deck → form_type + language + default card types

- [x] **Tạo `app/api/admin/content-types/route.ts`**
  - GET / PUT (Read + Update form config)

### 1.8 Session Persistence Logic 🆕

- [x] **Tạo `lib/session.ts`**
  - Function: `saveSession(formType, data)` → localStorage
  - Function: `loadSession(formType): SessionState | null`
  - Function: `clearSession(formType)`
  - Function: `resetContentFields(formType)` — chỉ reset field nội dung, giữ field cố định

- [x] **Tạo `hooks/useSession.ts`**
  - Hook React cho session management
  - Auto-load on mount, auto-save on change

---

## PHASE 2 — UI Components

### 2.1 Layout & Navigation

- [ ] **Tạo `components/layout/Sidebar.tsx`**
  - Links: Dashboard, Tạo mới, Lịch sử, **Quản lý (Admin)**, Cài đặt
  - Active state indicator

- [ ] **Tạo `components/layout/Header.tsx`**
  - Tiêu đề trang hiện tại
  - Nút "Tạo card mới" shortcut

- [ ] **Tạo `components/layout/StatusBar.tsx`**
  - 🟢 Anki kết nối / 🔴 Chưa kết nối
  - Auto-refresh 30s

- [ ] **Cập nhật `app/layout.tsx`**
  - Sidebar + Header wrapper

### 2.2 Dashboard Page

- [ ] **Tạo `app/page.tsx`**
  - Widgets thống kê
  - 10 từ gần đây
  - Quick action: nút "Tạo mới"

### 2.3 Create Page — Form nhập liệu

- [ ] **Tạo `components/create/CategorySelector.tsx`** 🆕 (Redesign)
  - **Dropdown** lấy từ Firestore `categories` collection
  - Filter theo `form_type` hiện tại
  - Lưu session

- [ ] **Tạo `components/create/LanguageSelector.tsx`**
  - 3 options với icons/flags
  - Lưu session

- [ ] **Tạo `components/create/DeckSelector.tsx`**
  - Dropdown từ Firestore `decks` collection
  - **Auto-detect form type** khi chọn deck (từ `DeckConfig.form_type`)
  - Lưu session

- [ ] **Tạo `components/create/CardTypeSelector.tsx`**
  - **Checkbox list từ Firestore `card_types`**
  - Filter theo form_type + language
  - "Chọn tất cả" / "Bỏ chọn tất cả"
  - Lưu session

- [ ] **Tạo `components/create/TopicSelector.tsx`** 🆕
  - **Checkbox list từ Firestore `topics`**
  - Chỉ hiện trong form IT
  - Lưu session

- [ ] **Tạo `components/create/LanguageForm.tsx`**
  - Thứ tự fields: **Ngôn ngữ → Deck → Category → Tags → Từ vựng → Ghi chú**
  - Session persistence cho fields cố định
  - Chỉ reset: Từ vựng + Ghi chú sau khi tạo thành công

- [ ] **Tạo `components/create/ITForm.tsx`**
  - Fields: Deck → **Topics (checkbox)** → Difficulty → Thuật ngữ → Định nghĩa → Keywords
  - Session: Deck, Topics, Difficulty

- [ ] **Tạo `components/create/GeneralForm.tsx`**
  - Fields: Deck → Tiêu đề → Nội dung → Tags
  - Session: Deck

- [ ] **Tạo `app/create/page.tsx`**
  - Chọn content type hoặc chọn Deck → auto form
  - Progress indicator khi generating
  - Chuyển `/preview` sau khi xong
  - **Sau khi tạo thành công → quay về form, chỉ reset content fields**

### 2.4 Preview Page

- [ ] **Tạo `components/preview/EditableField.tsx`**
  - Click to edit, save/cancel

- [ ] **Tạo `components/preview/CollocationEditor.tsx`** 🆕
  - Hiển thị list collocations
  - Thêm/sửa/xoá từng mục
  - Drag to reorder

- [ ] **Tạo `components/preview/ImageSelector.tsx`**
  - Grid 5 ảnh Unsplash
  - Chọn / Tìm lại / Bỏ qua

- [ ] **Tạo `components/preview/AudioPlayer.tsx`**
  - Play/stop, Tạo lại

- [ ] **Tạo `components/preview/CardPreview.tsx`**
  - CSS 3D flip card
  - Front/Back preview

- [ ] **Tạo `components/preview/CardList.tsx`**
  - Grid tất cả card types
  - Checkbox bỏ bớt card type

- [ ] **Tạo `app/preview/page.tsx`**
  - Section: Info + Collocations + Image + Audio + Card preview
  - Nút "Xác nhận & Tạo"

### 2.5 History Page

- [ ] **Tạo `components/history/FilterBar.tsx`**
  - Filter: Category (dropdown từ DB), Language, Deck, Date range
  - Search: từ/nghĩa

- [ ] **Tạo `components/history/HistoryTable.tsx`**
  - Columns + pagination

- [ ] **Tạo `app/history/page.tsx`**

- [ ] **Tạo `app/history/[id]/page.tsx`**

### 2.6 Admin Page 🆕

- [ ] **Tạo `app/admin/page.tsx`**
  - Tab navigation: Categories | Card Types | Topics | Decks | Content Types

- [ ] **Tạo `components/admin/CategoryManager.tsx`**
  - Table: Tên, Form type, Thứ tự, Trạng thái, Actions
  - Modal: Thêm mới / Sửa

- [ ] **Tạo `components/admin/CardTypeManager.tsx`**
  - Table: Code, Tên, Form type, Language, Mặc định, Actions
  - Toggle: is_default, is_active

- [ ] **Tạo `components/admin/TopicManager.tsx`**
  - Table: Tên, Thứ tự, Actions
  - CRUD đơn giản

- [ ] **Tạo `components/admin/DeckManager.tsx`**
  - Table: Anki name, Display name, Form type, Language, Actions
  - **Form thiết lập mapping:** default card types, default category

- [ ] **Tạo `components/admin/ContentTypeManager.tsx`**
  - Xem cấu hình form hiện có
  - Chỉnh sửa: fields, thứ tự, required, session persistent
  - (Phase 2+): Thêm content type mới

### 2.7 Settings Page

- [ ] **Tạo `app/settings/page.tsx`**
  - Trạng thái API connections
  - AnkiConnect URL config
  - Gemini model selection

---

## PHASE 3 — Tích hợp & Luồng hoàn chỉnh

### 3.1 State Management

- [ ] **Tạo React Context / Zustand store**
  - Chia sẻ dữ liệu giữa `/create` → `/preview`
  - Tích hợp session persistence

- [ ] **Tạo `hooks/useAnkiConnection.ts`**
  - Polling connection status
  - Auto-reconnect

- [ ] **Tạo `hooks/useFirestore.ts`**
  - CRUD helpers cho các collections

### 3.2 Flow End-to-End: Language Card

- [ ] **Chinese Flow (đầy đủ nhất, test trước):**
  - Nhập "书" → Gemini trả JSON (có collocations) → parse
  - TTS cho "书" + câu ví dụ → storeMediaFile
  - Unsplash search → hiển thị 5 ảnh
  - Preview 7 card types (có collocations)
  - Xác nhận → AnkiConnect tạo notes
  - Firestore lưu entry
  - **Quay về form → chỉ reset Từ vựng + Ghi chú**

- [ ] **Japanese Flow** (với Katakana field)
- [ ] **English Flow** (với collocations)

### 3.3 Flow End-to-End: IT Vocabulary

- [ ] Nhập "API" + Topics checkbox → Gemini (có analogy) → Preview → Anki

### 3.4 Flow: Deck → Form Mapping

- [ ] Khi chọn Deck → auto chọn form type + language + load defaults
- [ ] Test: chọn "Language::Chinese::HSK1" → tự hiện form Language, ngôn ngữ Chinese

### 3.5 Error Handling

- [ ] Anki chưa mở → dialog hướng dẫn
- [ ] Gemini lỗi → retry 1 lần, fallback nhập tay
- [ ] TTS lỗi → bỏ qua audio
- [ ] Unsplash lỗi → bỏ qua ảnh
- [ ] Trùng từ → cảnh báo

---

## PHASE 4 — Hoàn thiện & Testing

### 4.1 UI/UX Polish

- [ ] Responsive trên 13" MacBook
- [ ] Dark mode support (admin UI)
- [ ] Loading skeletons
- [ ] Toast notifications
- [ ] Keyboard shortcuts: `Ctrl+Enter` submit, `Esc` cancel edit

### 4.2 Testing thủ công

- [ ] **Test 1:** Tạo Chinese card "你好" — tất cả card types + collocations
- [ ] **Test 2:** Tạo Japanese card "ありがとう" — tất cả card types
- [ ] **Test 3:** Tạo English card "serendipity" — tất cả card types
- [ ] **Test 4:** Tạo IT card "REST API" topics: Backend, Architecture
- [ ] **Test 5:** Kiểm tra card đẹp trong Anki Desktop (font OK, layout OK)
- [ ] **Test 6:** Sync → AnkiWeb → iPad — font CJK hiển thị đúng
- [ ] **Test 7:** Session persistence — tạo 5 từ liên tiếp, chỉ nhập từ mới
- [ ] **Test 8:** Admin CRUD — thêm/sửa/xoá category, topic, card type
- [ ] **Test 9:** Deck mapping — chọn deck → auto form type
- [ ] **Test 10:** Anki Desktop đóng → error handling OK
- [ ] **Test 11:** Trùng từ → duplicate warning OK
- [ ] **Test 12:** Lịch sử hiển thị đúng, filter hoạt động

### 4.3 Documentation

- [ ] Viết `README.md` (tiếng Việt):
  - Hướng dẫn setup từ đầu
  - Hướng dẫn lấy API keys
  - Hướng dẫn cài AnkiConnect
  - Cách chạy project
  - Hướng dẫn sử dụng trang Admin
  - Troubleshooting thường gặp

---

## 📊 Tóm tắt tiến độ

| Phase | Tasks | Hoàn thành | % |
|---|---|---|---|
| Phase 0 — Setup | 24 | 0 | 0% |
| Phase 1 — Backend | 28 | 0 | 0% |
| Phase 2 — Frontend | 36 | 0 | 0% |
| Phase 3 — Integration | 14 | 0 | 0% |
| Phase 4 — Testing | 18 | 0 | 0% |
| **Tổng** | **~120** | **0** | **0%** |

---

## 🚦 Thứ tự ưu tiên thực hiện

```
TUẦN 1: Phase 0 (Setup song song)
  ├── 0.1 API Keys
  ├── 0.2 Anki Setup
  ├── 0.3 Next.js Setup
  └── 0.4 Seed data Firestore

TUẦN 2: Phase 1 (Backend core)
  ├── 1.1 Types
  ├── 1.2 AnkiConnect
  ├── 1.3 Gemini (prompts v1.1)
  ├── 1.4 TTS
  ├── 1.5 Unsplash
  └── 1.8 Session logic

TUẦN 3: Phase 1 (Backend admin) + Phase 2 (UI cơ bản)
  ├── 1.6 History routes
  ├── 1.7 Admin CRUD routes
  ├── 2.1 Layout & Nav
  └── 2.3 Create Form (với session)

TUẦN 4: Phase 2 (UI hoàn chỉnh)
  ├── 2.4 Preview Page (với collocations)
  ├── 2.6 Admin Page
  └── 2.7 Settings

TUẦN 5: Phase 3 (Integration)
  ├── 3.1 State Management
  ├── 3.2 Language flows (test Trung → Nhật → Anh)
  ├── 3.3 IT flow
  ├── 3.4 Deck mapping
  └── 3.5 Error handling

TUẦN 6: Phase 4 + Phase 2 còn lại
  ├── 2.2 Dashboard
  ├── 2.5 History
  ├── 4.1 UI Polish
  ├── 4.2 Testing
  └── 4.3 Docs
```
