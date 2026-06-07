
# ✅ Task List — AnkiFlow Project

**Dự án:** AnkiFlow — Personal Flashcard Automation  
**Cập nhật lần cuối:** 2026-06-07 (v1.2 — đã hoàn thành Design Refactor, xem mục cuối file)

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

### 2.0 UI Foundation (Shared Components) 🆕

> ⚠️ **Làm trước tất cả** — Các màn hình 2.1–2.7 phụ thuộc vào section này.  
> Tham chiếu: `ankiflow/docs/design/COMPONENT.md` cho props & variants đầy đủ.

#### UI Primitives

- [x] **Tạo `components/ui/Button.tsx`**
  - Variants: `primary` | `secondary` | `ghost` | `destructive`
  - Size: `sm` | `md` | `lg`
  - Props: `loading`, `leftIcon`, `rightIcon`
  - (token: `bg-primary`, `bg-primary/10`, `border-outline-var`, `bg-error-container`)
  - Dùng ở: Create, Preview, Admin, Settings, History

- [x] **Tạo `components/ui/FormField.tsx`** (Input + Textarea + Select)
  - `Input`: nền `bg-surface-container`, focus ring `ring-primary/30`
  - `Textarea`: tương tự Input, `resize-none`
  - `Select`: nền `bg-white border-outline-var`, icon ChevronDown
  - `FieldWrapper`: bọc label + error message
  - Dùng ở: Create (mọi form), Admin (CRUD modal), Settings

- [x] **Tạo `components/ui/Badge.tsx`**
  - Variants: `neutral` | `active` | `inactive` | `pending` | `ai` | `language` | `level`
  - Prop `onRemove` → hiển thị nút × (dùng cho tag removable)
  - (token: `bg-surface-high`, `bg-primary/10`, `bg-error-container`, `bg-tertiary-fixed`)
  - Dùng ở: History (trạng thái), Admin (is_active), Create (tags)

- [x] **Tạo `components/ui/Toggle.tsx`**
  - Props: `checked`, `onChange`, `label`, `description`, `disabled`
  - Nền toggle: `bg-outline-var` → checked: `bg-primary`
  - Dùng ở: Admin (is_active, is_default), Settings

#### Feedback Components

- [x] **Tạo `components/ui/Modal.tsx`**
  - Props: `open`, `onClose`, `title`, `description`, `size` (`sm`|`md`|`lg`)
  - Header tonal: `bg-surface-container rounded-t-xl`
  - Backdrop: `bg-on-surface/30 backdrop-blur-sm`
  - Close on Escape + click outside
  - Dùng ở: Admin (thêm/sửa record), Create (confirm), Preview (confirm tạo)

- [x] **Tạo `components/ui/LoadingOverlay.tsx`**
  - Dùng `StepIndicator` + `ProgressBar` + `FlowTip` bên trong
  - Props: `open`, `steps[]`, `progress`, `flowTip`, `statusText`
  - Dùng ở: Create (sau khi nhấn "Tạo nháp" — hiện 3 bước: Gemini → TTS → Unsplash)

- [x] **Tạo `components/ui/StepIndicator.tsx`**
  - Status: `completed` | `active` | `pending`
  - completed → icon Check màu `bg-primary text-white`
  - active → border `border-2 border-primary`
  - Dùng ở: LoadingOverlay

- [x] **Tạo `components/ui/ProgressBar.tsx`**
  - Size: `sm` (1.5px) | `md` (2.5px)
  - Nền `bg-surface-high`, fill `bg-primary`
  - Dùng ở: LoadingOverlay, Dashboard

#### Data Display

- [x] **Tạo `components/ui/DataTable.tsx`**
  - Props: `data[]`, `columns[]`, `onRowClick`, `keyField`, `emptyMessage`
  - Column config: `key`, `header`, `width`, `align`, `render` (custom cell)
  - Header row: `border-b border-outline-var/50`, label `text-label-sm uppercase`
  - Row hover: `hover:bg-surface-container/50`
  - Dùng ở: History (HistoryTable), Admin (tất cả Manager)

- [x] **Tạo `components/ui/FilterBar.tsx`**
  - Search input: `rounded-full bg-white border-outline-var pl-9` + icon Search
  - Active filter badges (dùng `Badge` variant `active` + onRemove)
  - Button "Clear all" màu `text-on-surface-var hover:text-error`
  - Dùng ở: History, Admin

#### Branding & Navigation

- [x] **Tạo `components/ui/AnkiFlowLogo.tsx`**
  - Icon Sparkles trên nền `bg-primary rounded-full`
  - Text: "AnkiFlow" font-serif + tagline "COGNITIVE SANCTUARY" bất biến
  - Size: `sm` | `md`
  - Dùng ở: NavigationSidebar

- [x] **Tạo `components/ui/ConnectedBadge.tsx`**
  - Props: `connected`, `label`
  - Dot: `bg-primary` (connected) | `bg-outline` (disconnected)
  - Container: `bg-surface-high rounded-lg`
  - Dùng ở: NavigationSidebar (bottom)

#### Utility

- [x] **Tạo `components/ui/FlowTip.tsx`**
  - Nền `bg-tertiary-fixed/30 border-tertiary-fixed/60`
  - Icon Lightbulb màu `text-tertiary`
  - Chỉ dùng cho AI tip / Flow Tip — không dùng cho mục đích khác (token: `--tertiary`)
  - Dùng ở: LoadingOverlay, Create (hint cho user)

- [x] **Tạo `lib/utils.ts`** — helper `cn()` (clsx + tailwind-merge)
  - Bắt buộc trước khi viết bất kỳ component nào

---

### 2.1 Layout & Navigation

- [x] **Tạo `components/layout/NavigationSidebar.tsx`** (thay thế `Sidebar.tsx`)
  - Container: `w-64 h-screen bg-surface-low border-r border-outline-var fixed left-0 top-0 z-30`
  - Logo area: dùng `AnkiFlowLogo` từ 2.0
  - Nav links: Dashboard `/dashboard`, Create `/create`, History `/history`, Admin `/admin`, Settings `/settings`
  - Nav item default: `text-on-surface-var hover:bg-primary/5 rounded-md`
  - Nav item active: `bg-primary/10 text-primary font-bold rounded-md` ← **KHÔNG dùng `bg-primary text-white`**
  - Bottom: `ConnectedBadge` từ 2.0 (polling Anki mỗi 30s)

- [x] **Tạo `components/layout/PageHeader.tsx`** (thay thế `Header.tsx`)
  - Breadcrumb separator: `›` (ký tự `›`) — **KHÔNG dùng `>` hay `/`**
  - Props: `title`, `crumbs[]`, `description`, `actions`
  - Title: `font-serif text-headline-md text-on-surface`
  - Dùng trên mọi page

- [x] **Cập nhật `app/layout.tsx`**
  - Font setup: `Newsreader` (variable `--font-serif`) + `Nunito Sans` (variable `--font-sans`)
  - body: `bg-app-bg font-sans text-on-surface antialiased` (token: `#faf6f0`)
  - Layout: `NavigationSidebar` (w-64 fixed) + `main` (ml-64 flex-1 px-8 py-8)

### 2.2 Create Page — Form nhập liệu

- [x] **Tạo `components/create/CategorySelector.tsx`**
  - Dùng `Select` từ 2.0 (`FormField.tsx`)
  - Dropdown lấy từ Firestore `categories`, filter theo `form_type` hiện tại
  - Session-persistent theo PRD Section 7 (Language form: lưu session)
  - Dùng ở: Create (Language form, IT form)

- [x] **Tạo `components/create/LanguageSelector.tsx`**
  - 3 options: English / Chinese / Japanese với icon cờ
  - Dùng `Badge` từ 2.0 (variant `language`) để hiển thị option đang chọn
  - Session-persistent (PRD Section 7: Language form lưu "Ngôn ngữ")

- [x] **Tạo `components/create/DeckSelector.tsx`**
  - Dùng `Select` từ 2.0 (`FormField.tsx`)
  - Dropdown từ Firestore `decks`, auto-detect `form_type` khi chọn
  - Session-persistent (tất cả form types)

- [x] **Tạo `components/create/CardTypeSelector.tsx`**
  - Dùng `Toggle` / checkbox pattern từ 2.0
  - Checkbox list từ Firestore `card_types`, filter theo form_type + language
  - "Chọn tất cả" / "Bỏ chọn tất cả" — dùng `Button` variant `ghost` từ 2.0
  - Session-persistent (Language form: lưu "Card Types")

- [x] **Tạo `components/create/TopicSelector.tsx`**
  - Dùng `Badge` từ 2.0 (variant `active` khi chọn, `neutral` khi chưa)
  - Checkbox list từ Firestore `topics`, chỉ hiện trong form IT
  - Session-persistent (IT form: lưu "Chủ đề")

- [x] **Tạo `components/create/LanguageForm.tsx`**
  - Dùng `Input`, `Textarea`, `FieldWrapper` từ `FormField.tsx` (2.0)
  - Thứ tự fields: Ngôn ngữ → Deck → Category → Tags → Từ vựng → Ghi chú
  - Tags: dùng `TagInput` từ 2.0
  - Session-persistent fields: Ngôn ngữ, Deck, Category, Tags, Card Types
  - Reset sau khi tạo thành công: Từ vựng, Ghi chú

- [x] **Tạo `components/create/ITForm.tsx`**
  - Dùng `Input`, `Textarea`, `FieldWrapper` từ `FormField.tsx` (2.0)
  - Fields: Deck → Topics → Difficulty → Thuật ngữ → Định nghĩa → Keywords
  - Session-persistent: Deck, Topics, Difficulty
  - Reset sau khi tạo: Thuật ngữ, Định nghĩa, Keywords

- [x] **Tạo `components/create/GeneralForm.tsx`**
  - Dùng `Input`, `Textarea` từ `FormField.tsx` (2.0)
  - Fields: Deck → Tiêu đề → Nội dung → Tags
  - Session-persistent: Deck

- [x] **Tạo `app/create/page.tsx`**
  - Dùng `LoadingOverlay` từ 2.0 khi generating (3 bước: Gemini → TTS → Unsplash)
  - Dùng `PageHeader` từ 2.1 với breadcrumb
  - Chọn Deck → auto detect form → render form tương ứng
  - Sau khi xong → chuyển `/preview`
  - Sau khi tạo thành công → quay về, chỉ reset content fields

### 2.3 Create Page — Form nhập liệu

- [x] **Tạo `components/create/CategorySelector.tsx`** 🆕 (Redesign)
  - **Dropdown** lấy từ Firestore `categories` collection
  - Filter theo `form_type` hiện tại
  - Lưu session

- [x] **Tạo `components/create/LanguageSelector.tsx`**
  - 3 options với icons/flags
  - Lưu session

- [x] **Tạo `components/create/DeckSelector.tsx`**
  - Dropdown từ Firestore `decks` collection
  - **Auto-detect form type** khi chọn deck (từ `DeckConfig.form_type`)
  - Lưu session

- [x] **Tạo `components/create/CardTypeSelector.tsx`**
  - **Checkbox list từ Firestore `card_types`**
  - Filter theo form_type + language
  - "Chọn tất cả" / "Bỏ chọn tất cả"
  - Lưu session

- [x] **Tạo `components/create/TopicSelector.tsx`** 🆕
  - **Checkbox list từ Firestore `topics`**
  - Chỉ hiện trong form IT
  - Lưu session

- [x] **Tạo `components/create/LanguageForm.tsx`**
  - Thứ tự fields: **Ngôn ngữ → Deck → Category → Tags → Từ vựng → Ghi chú**
  - Session persistence cho fields cố định
  - Chỉ reset: Từ vựng + Ghi chú sau khi tạo thành công

- [x] **Tạo `components/create/ITForm.tsx`**
  - Fields: Deck → **Topics (checkbox)** → Difficulty → Thuật ngữ → Định nghĩa → Keywords
  - Session: Deck, Topics, Difficulty

- [x] **Tạo `components/create/GeneralForm.tsx`**
  - Fields: Deck → Tiêu đề → Nội dung → Tags
  - Session: Deck

- [x] **Tạo `app/create/page.tsx`**
  - Chọn content type hoặc chọn Deck → auto form
  - Progress indicator khi generating
  - Chuyển `/preview` sau khi xong
  - **Sau khi tạo thành công → quay về form, chỉ reset content fields**

### 2.3 Preview Page

- [x] **Tạo `components/preview/EditableField.tsx`**
  - Click to edit inline, nút Save / Cancel
  - Dùng `Input` hoặc `Textarea` từ 2.0 khi ở edit mode
  - Focus ring: `ring-2 ring-primary/30`

- [x] **Tạo `components/preview/CollocationEditor.tsx`**
  - Hiển thị list collocations dạng badge có thể xóa — dùng `Badge` variant `neutral` + `onRemove` từ 2.0
  - Thêm mục mới bằng `Input` từ 2.0
  - Drag to reorder: dùng `@dnd-kit/core` (đề xuất) — `DndContext` + `SortableContext`
  - Dùng ở: Preview page (cột collocations)

- [x] **Tạo `components/preview/ImageSelector.tsx`**
  - Grid 5 ảnh Unsplash (2-col grid)
  - Ảnh được chọn: `ring-2 ring-primary`
  - Nút "Tìm lại" — dùng `Button` variant `ghost` từ 2.0
  - Dùng ở: Preview page

- [x] **Tạo `components/preview/AudioPlayer.tsx`**
  - Nút Play/Stop + nút "Tạo lại" — dùng `Button` từ 2.0
  - Dùng ở: Preview page

- [x] **Tạo `components/preview/CardPreview.tsx`**
  - Dùng component `CardPreview` từ COMPONENT.md (`src/components/features/card/CardPreview.tsx`)
  - Tabs: `front-back` | `back-front` | `sentence`
  - Front card: `bg-white rounded-xl shadow-card`
  - Back card: `bg-surface-low rounded-xl`
  - Content mapping theo `card_type` (word_to_meaning, audio_to_word, fill_in_blank...)

- [x] **Tạo `components/preview/CardList.tsx`**
  - Grid tất cả card types (2-col)
  - Checkbox bỏ bớt card type — dùng `Badge` + Toggle từ 2.0
  - Dùng ở: Preview page

- [x] **Tạo `app/preview/page.tsx`**
  - Layout 8:4 grid (`col-span-8` content + `col-span-4` card preview)
  - Dùng `PageHeader` từ 2.1, `Button` variant `primary` từ 2.0 ("Xác nhận & Tạo")
  - Dùng `Modal` từ 2.0 để confirm trước khi tạo
  - Section: Info + Collocations + Image + Audio + Card preview

### 2.4 History Page

- [x] **Tạo `components/history/HistoryTable.tsx`**
  - **Dùng `DataTable` từ 2.0** — không tạo lại table logic
  - Columns: Từ vựng, Nghĩa, Ngôn ngữ/Form, Deck, Trạng thái, Ngày tạo, Actions
  - Trạng thái dùng `Badge` từ 2.0 (variant `active`/`inactive`/`pending`)
  - Actions: xem chi tiết, xoá — dùng `Button` từ 2.0

- [x] **Sử dụng `FilterBar` từ 2.0** trong History page
  - Filters: Category, Language, Deck, Date range
  - Search: placeholder tiếng Anh "Search vocabulary, meaning..."
  - Không tạo `components/history/FilterBar.tsx` riêng — reuse từ `components/ui/FilterBar.tsx`

- [x] **Tạo `components/history/WordDetailCard.tsx`**
  - Hiển thị: word, reading, meaning, level badge, sync-status badge, nút play audio
  - Border left accent: `border-l-[4px] border-l-primary`
  - Spec đầy đủ: `docs/design/COMPONENT.md` mục 23

- [x] **Tạo `app/history/page.tsx`**
  - Dùng `PageHeader` từ 2.1, `FilterBar` + `DataTable` từ 2.0

- [x] **Tạo `app/history/[id]/page.tsx`** 🆕 (trang mới — Design Refactor 2026-06)
  - Dùng `WordDetailCard` + `CardPreview`
  - Layout 8:4 grid (`lg:grid-cols-12`, content `col-span-8` + preview sticky `col-span-4`)

### 2.5 Admin Page 🆕 (trang mới — Design Refactor 2026-06)

- [x] **Tạo `app/admin/page.tsx`**
  - Tab navigation (`Tabs` từ 2.0, `flex-wrap` bắt buộc): Categories | Card Types | Topics | Decks | Content Types
  - Dùng `PageHeader` từ 2.1 với `actions` slot cho nút "Add new"

- [x] **Tạo `components/admin/CategoryManager.tsx`**
  - **Dùng `DataTable` từ 2.0** — không tạo table logic mới
  - Columns: Name, Form type, Order, Status (`Badge` active/inactive), Actions
  - Thêm/Sửa: dùng `Modal` từ 2.0 + form bên trong dùng `Input`, `Select` từ `FormField.tsx`
  - Xoá: dùng `Button` variant `destructive` từ 2.0 + confirmation trong `Modal`

- [x] **Tạo `components/admin/CardTypeManager.tsx`**
  - **Dùng `DataTable` từ 2.0**
  - Columns: Code, Name, Form type, Language, Default, Status, Actions
  - Toggle is_default / is_active: dùng `Toggle` từ 2.0

- [x] **Tạo `components/admin/TopicManager.tsx`**
  - **Dùng `DataTable` từ 2.0**
  - Columns: Name, Order, Status, Actions
  - CRUD: dùng `Modal` + `Input` từ 2.0

- [x] **Tạo `components/admin/DeckManager.tsx`**
  - **Dùng `DataTable` từ 2.0**
  - Columns: Anki name, Display name, Form type, Language, Actions
  - Form thiết lập mapping (default card types, default category): dùng `Modal` + `Select` từ 2.0

- [x] **Tạo `components/admin/ContentTypeManager.tsx`**
  - **Dùng `DataTable` từ 2.0** để liệt kê fields
  - Xem + sửa cấu hình form (fields, thứ tự, required, session_persistent)
  - Mỗi field toggle: dùng `Toggle` từ 2.0
  - Form dài: bọc trong `max-h-[60vh] overflow-y-auto` bên trong `Modal`

### 2.6 Dashboard 🆕 (trang mới — Design Refactor 2026-06)

- [x] **Tạo `components/ui/StatCard.tsx`**
  - Props: `label`, `value`, `delta`, `icon` (đã đổi so với spec gốc `unit`/`trend`/`trendPositive` — xem COMPONENT.md mục 7)
  - Grid responsive: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`
  - `items-start` + `flex-shrink-0` trên icon để tránh đè lên nhãn 2 dòng
  - Dùng ở: Dashboard (Total Vocabulary, Synced to Anki, Created Today, Success Rate)

- [x] **Tạo `app/dashboard/page.tsx`**
  - Greeting: `font-serif text-display text-on-surface`
  - StatCard grid responsive
  - Danh sách entry gần đây (link sang `/history/[id]`)
  - Language breakdown (progress bar) + 1 AI suggestion card (`FlowTip`)
  - Quick action: `Button` variant `primary` "Create a card" → `/create`

---

### 2.7 Settings Page 🆕 (trang mới — Design Refactor 2026-06)

- [x] **Tạo `app/settings/page.tsx`**
  - Dùng `PageHeader` từ 2.1
  - Integration status card cho từng API connection (Anki / Gemini / TTS / Unsplash) — dùng `ConnectedBadge` pattern + `Badge`
  - AnkiConnect URL: dùng `Input` từ 2.0 — persist vào Firestore `settings.anki_connect_url`
  - Gemini model selection: dùng `Select` từ 2.0 — persist vào `settings.gemini_model`
  - Toggle unsplash_enabled / tts_enabled: dùng `Toggle` từ 2.0
  - Truy cập Firestore qua **Firebase Client SDK trực tiếp** (quyết định kiến trúc của Design Refactor — không qua `/api/admin/*`)
  - **`settings` là singleton — chỉ update document hiện có, không tạo mới** (đúng theo CLAUDE.md)

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
| Phase 2 — Frontend (2.0 Foundation: 14, 2.1–2.7 Screens: 44) | **58** | 0 | 0% |
| Phase 3 — Integration | 14 | 0 | 0% |
| Phase 4 — Testing | 18 | 0 | 0% |
| **Tổng** | **~142** | **0** | **0%** |

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
