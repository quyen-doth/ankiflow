# 📋 PRD — Anki フラッシュカード自動生成システム

**プロジェクト名:** AnkiFlow — AI Flashcard Automation  
**バージョン:** v1.1  
**作成日:** 2026-04-15  
**更新日:** 2026-07-19  
**作者:** hong-quyen  
**ステータス:** 確定 — v1 要件（初期スコープ）

> **注記:** 本書は開発開始時点の要件定義であり、プロダクトはその後
> マルチユーザー対応（Firebase 認証 + Firestore セキュリティルール）、
> ユーザー別 Content Type、LINE 通知のユーザー別配信などへ発展している。
> 現行アーキテクチャは `docs/REFERENCE.md`・`README.md` を参照。

---

## 1. 🎯 概要 & 目的

### 1.1 解決すべき課題

Anki でのフラッシュカード手動作成は多くの時間と労力を要します:

- 自分で意味、例文、発音、画像を探す必要がある
- 各種カード (EN→VN、VN→EN、リスニング→推測...) を手動で作成する必要がある
- 一貫したプロセスがない
- 重複を避けるための学習済み単語の履歴が保存されない

### 1.2 解決策

MacBook 上でローカル実行する **Admin Web UI** を構築し、以下を可能にする:

- 単語/学習コンテンツを入力 → AI が自動的に情報を入力
- 作成前にプレビュー & 編集
- 1 回の入力から複数種類のカードを作成
- AnkiConnect 経由で Anki Desktop に自動プッシュ
- Firebase Firestore に履歴を保存
- Admin ページ経由で柔軟な管理: categories、card types、templates、form fields

### 1.3 主要目標

| 目標                                                              | 測定方法                             |
| --------------------------------------------------------------------- | ------------------------------------ |
| 1 枚のカード作成時間を ~10 分 → ~30 秒に短縮                      | 入力から Anki までの時間           |
| 1 回の入力から複数種類のカードを自動作成                             | ≥ 4 card types/単語 (言語)         |
| 3 言語をサポート: 英語、中国語、日本語                                   | 各言語固有のメタデータを完備 |
| Free tier 内でコスト $0/月                                      | 無料枠を超えない         |
| スムーズなワークフロー — 単語入力のみ、固定フィールドの再選択不要 | Session persistence                  |

---

## 2. 👤 利用者

**単一:** 個人 (プロジェクトオーナー)

**使用デバイス:**

- **カード作成:** MacBook (localhost)
- **学習:** iPad、iPhone (AnkiWeb sync 経由)

**技術的背景:** Fullstack、中級レベル (HTML/CSS、React、PHP、JS/TS、SQL)

---

## 3. 🗺️ 操作フロー (User Flow)

### 3.1 メインフロー — 言語カードの作成

```
[1] Admin UI を開く (localhost:3000)
    ↓
[2] 言語を選択: "Chinese" (session に保存、次回は再選択不要)
    ↓
[3] Anki Deck を選択: "Chinese::HSK2" (session に保存)
    → Deck 選択時 → システムが適切な form type を自動認識
    ↓
[4] Category を選択: "日常生活" (DB からの dropdown、session に保存)
    ↓
[5] 入力: 語彙 "书" ← メイン操作、他のフィールドは保存済み
    ↓
[6] "下書きを作成" をクリック → システムが呼び出す:
    ├── Claude AI エージェント → ベトナム語の意味、ピンイン、ハンベトナム音、例文、collocations、品詞、HSK レベルを生成
    ├── Google TTS → audio ファイルを作成 (Anki media folder に保存)
    └── Unsplash API → イラスト画像を検索 (URL を保存)
    ↓
[7] 作成されるすべての card types のプレビューを表示
    ↓
[8] ユーザーがレビュー、必要に応じて編集
    ↓
[9] "確認 & 作成" をクリック
    ↓
[10] AnkiConnect API (localhost:8765) → Anki Desktop でノートを作成
    ↓
[11] Firebase Firestore に履歴を保存
    ↓
[12] 作成フォームに戻る → 語彙フィールドがリセット、他のフィールドは維持
    ↓
[13] Anki Desktop を手動 sync → AnkiWeb → iPad/iPhone ✅
```

### 3.2 サブフロー — 専門カードの作成 (IT など)

```
[1] Anki Deck を選択: "Vocabulary::IT" → システムが IT フォームを表示
    ↓
[2] 入力フォームが適切なフィールドを表示:
    - メイン用語 (必須)
    - 短い定義 (必須)
    - 関連 Keywords
    - トピック: DB からの checkbox list (Database、Frontend、Backend...)
    - Difficulty (session に保存)
    ↓
[3-12] メインフローと同様 (AI が残りを補完)
```

---

## 4. 🏗️ システムアーキテクチャ

/api/audio/\* は 3 つのエンドポイントから構成: /generate (TTS のみ)、/store (AnkiConnect のみ)、/ (統合、後方互換)。

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
│  Claude Haiku 4.5  → カードコンテンツを生成         │
│  Google Cloud TTS  → 発音 audio を作成          │
│  Unsplash API      → イラスト画像を検索           │
│  Firebase Firestore→ 履歴 + config データを保存  │
└─────────────────────────────────────────────────┘
          │
          ▼ Sync
┌─────────────────────────────────────────────────┐
│  AnkiWeb (cloud) → iPad / iPhone                │
└─────────────────────────────────────────────────┘
```

---

## 5. 🛠️ テックスタック

| レイヤー               | 技術                  | バージョン               | 選定理由                                |
| ------------------- | -------------------------- | ----------------------- | ----------------------------------------- |
| **Frontend**        | Next.js                    | 16 (App Router)         | 1 プロジェクトで Full-stack、React 19 ベース |
| **Language**        | TypeScript                 | 5+ (strict mode)        | Type safety、メンテナンスしやすい                  |
| **Styling**         | Tailwind CSS               | v4                      | 迅速な UI 開発、`@theme` directive  |
| **Backend**         | Next.js API Routes         | -                       | Serverless、シンプル                      |
| **Database**        | Firebase Firestore         | -                       | 広い Free tier、real-time                 |
| **AI**              | Anthropic Claude Haiku 4.5 | via `@anthropic-ai/sdk` | Tool-use、structured output               |
| **TTS**             | Google Cloud TTS           | -                       | 月間 100 万文字無料                       |
| **Images**          | Unsplash API               | v1                      | 無料、高品質な画像                  |
| **Anki**            | AnkiConnect                | 6+                      | ローカルプラグイン、フル API                  |
| **Runtime**         | Node.js                    | 20+                     | LTS stable                                |
| **Package Manager** | npm                        | -                       | Node.js 付属、追加インストール不要        |

---

## 6. 📂 データモデル

### 6.1 Firestore Collections

#### Collection: `entries` (作成された語彙)

```typescript
interface Entry {
    id?: string; // Firestore の Document ID
    user_id: string; // Phase 1: 'local-user'。Phase 3: Firebase Auth UID

    // 分類情報
    category_id: string | null; // categories コレクションへの参照
    language?: LanguageType | null; // "en" | "zh" | "ja" (言語の場合)
    form_type: FormType | string; // 使用された form の種類

    // 共通コンテンツ (form_type に応じる)
    word?: string; // 語彙 (Language)
    term?: string; // 用語 (IT)
    title?: string; // タイトル (General)
    meaning_vi?: string; // ベトナム語の意味
    definition?: string; // 定義 (IT)
    content?: string; // 詳細なコンテンツ (General)
    note?: string; // 個人メモ
    word_type?: string; // 名詞、動詞、形容詞...

    // 言語固有のメタデータ
    pinyin?: string; // 中国語のみ
    han_viet?: string; // 中国語のみ
    hiragana?: string; // 日本語のみ
    katakana?: string; // 日本語のみ
    romaji?: string; // 日本語のみ
    ipa?: string; // 国際発音記号 (英語)
    level?: string; // HSK1-6、JLPT N5-N1、CEFR A1-C2

    // 例文 & Collocations
    example_sentence?: string; // 簡潔で自然な例文 (原語)
    example_translation?: string; // 例文のベトナム語訳
    collocations?: string[]; // よく共起するフレーズ
    // 例: ["蘸点儿醋", "白醋", "米醋"]

    // Media
    image_url?: string; // Unsplash URL
    image_credit?: string; // 写真家名
    audio_url?: string; // TTS からの audio ファイル URL/名前
    audio_example_url?: string; // 例文の Audio

    // Anki
    anki_deck: string; // Anki 内のデック名
    anki_note_ids?: number[]; // 作成された notes の IDs
    card_type_ids: string[]; // 選択された card types の IDs
    tags: string[]; // Anki のタグ (AI 生成 + ユーザーカスタム)

    // 専門分野 (IT など)
    keywords?: string[]; // 関連キーワード
    topic_ids?: string[]; // topics コレクションへの参照
    difficulty?: 'easy' | 'medium' | 'hard';

    // システムメタデータ
    created_at: Timestamp;
    updated_at: Timestamp;
    status: 'draft' | 'reviewed' | 'synced';
}
```

#### Collection: `categories` (コンテンツ分類) — 新規

```typescript
interface Category {
    id: string;
    name: string; // 表示名: "日常生活"、"ビジネス"、"旅行"...
    form_type: FormType; // このカテゴリを使用する form
    sort_order: number; // 表示順序
    is_active: boolean; // 使用中かどうか
    created_at: Timestamp;
    updated_at: Timestamp;
}

// サンプルデータ:
// { name: "日常生活",       form_type: "form_language",  sort_order: 1 }
// { name: "ビジネス",     form_type: "form_language",  sort_order: 2 }
// { name: "旅行",        form_type: "form_language",  sort_order: 3 }
// { name: "料理",        form_type: "form_language",  sort_order: 4 }
// { name: "テクノロジー",      form_type: "form_language",  sort_order: 5 }
// { name: "教育",       form_type: "form_language",  sort_order: 6 }
// { name: "医療",           form_type: "form_language",  sort_order: 7 }
// { name: "文化",        form_type: "form_language",  sort_order: 8 }
```

#### Collection: `card_types` (カードの種類) — 新規

```typescript
interface CardTypeConfig {
    id: string;
    code: string; // 一意なコード: "word_to_meaning"、"audio_to_word"...
    name: string; // 表示名: "単語 → ベトナム語の意味"
    description: string; // 短い説明
    form_type: FormType; // どの form に属するか
    language?: LanguageType; // 特定の言語にのみ適用 (null = すべて)
    is_default: boolean; // デフォルトで選択されるか
    is_active: boolean;
    sort_order: number;
    created_at: Timestamp;
}

// サンプルデータ:
// { code: "word_to_meaning",   name: "単語 → ベトナム語の意味",          form_type: "form_language", language: null,      is_default: true }
// { code: "meaning_to_word",   name: "ベトナム語の意味 → 単語",          form_type: "form_language", language: null,      is_default: true }
// { code: "audio_to_word",     name: "リスニング → 単語当て",          form_type: "form_language", language: null,      is_default: true }
// { code: "image_to_word",     name: "画像 → 単語当て",           form_type: "form_language", language: null,      is_default: true }
// { code: "fill_in_blank",     name: "穴埋め",      form_type: "form_language", language: null,      is_default: true }
// { code: "reading_to_word",   name: "ピンイン → 漢字",        form_type: "form_language", language: "zh", is_default: false }
// { code: "word_to_reading",   name: "漢字 → ピンイン",        form_type: "form_language", language: "zh", is_default: false }
// { code: "concept_to_def",    name: "概念 → 定義",  form_type: "form_it",      language: null,      is_default: true }
// { code: "def_to_concept",    name: "定義 → 概念",  form_type: "form_it",      language: null,      is_default: true }
```

#### Collection: `topics` (IT トピック) — 新規

```typescript
interface Topic {
    id: string;
    name: string; // "Database"、"Frontend"、"Backend"、"Algorithm"...
    form_type: FormType; // どの form に属するか (現在: "it")
    is_active: boolean;
    sort_order: number;
    created_at: Timestamp;
}

// サンプルデータ:
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

#### Collection: `decks` (デックリスト + マッピング)

```typescript
interface DeckConfig {
    id: string;
    anki_deck_name: string; // Anki 内の完全な名前 (例: "Chinese::HSK1")
    display_name: string; // UI 上の表示名
    form_type: FormType; // ← 新規: デック → form type のリンク
    language?: LanguageType; // form_type が "language" の場合のみ
    default_card_type_ids: string[]; // このデックのデフォルト Card types
    default_category_id?: string; // デフォルト Category (optional)
    is_active: boolean;
    sort_order: number;
    created_at: Timestamp;
}

// サンプルデータ:
// { anki_deck_name: "Language::Chinese::HSK1", display_name: "中国語 HSK1", form_type: "form_language", language: "zh" }
// { anki_deck_name: "Language::Chinese::HSK2", display_name: "中国語 HSK2", form_type: "form_language", language: "zh" }
// { anki_deck_name: "Language::Japanese::N5",  display_name: "日本語 N5",    form_type: "form_language", language: "ja" }
// { anki_deck_name: "Language::English::B1",   display_name: "英語 B1",     form_type: "form_language", language: "en" }
// { anki_deck_name: "Vocabulary::IT",          display_name: "IT Vocabulary",     form_type: "form_it",      language: null }
// { anki_deck_name: "Vocabulary::General",     display_name: "一般知識",   form_type: "form_general", language: null }
```

#### Collection: `content_types` (コンテンツタイプ / Form config) — 新規

```typescript
interface ContentType {
    id: string;
    code: FormType; // "language" | "it" | "general" | "custom"
    name: string; // 表示名: "言語"、"IT Vocabulary"、"一般知識"
    description: string;
    icon: string; // Icon class または emoji
    fields: FormFieldConfig[]; // 表示するフィールドの設定
    is_active: boolean;
    sort_order: number;
    created_at: Timestamp;
    updated_at: Timestamp;
}

// 各 form 種類のフィールド設定
interface FormFieldConfig {
    field_key: string; // "word"、"meaning"、"category_id"...
    label: string; // "語彙"、"ベトナム語の意味"
    type: 'text' | 'textarea' | 'dropdown' | 'checkbox_group' | 'tags';
    is_required: boolean;
    is_session_persistent: boolean; // session に保存するか
    sort_order: number;
    placeholder?: string;
    data_source?: string; // "categories" | "topics" | "decks" — DB から options を取得する場合
}
```

#### Collection: `settings` (設定)

```typescript
interface Settings {
    unsplash_enabled: boolean;
    tts_enabled: boolean;
    ai_model: string; // Claude モデル (例 claude-haiku-4-5)
    web_search_enabled: boolean; // AI エージェントが web_search tool を使用できるようにする
    anki_connect_url: string; // デフォルト: http://localhost:8765
    allow_duplicate: boolean; // 重複エントリの作成を許可
    auto_audio: boolean; // generate 時に自動で audio を作成
    auto_image: boolean; // generate 時に自動で画像を検索
    updated_at: Timestamp;
}
```

### 6.2 Enum Types

```typescript
enum FormType {
    LANGUAGE = 'form_language', // Language vocab (EN/ZH/JA)
    IT = 'form_it', // IT vocabulary
    GENERAL = 'form_general', // General knowledge
}

enum LanguageType {
    ENGLISH = 'en',
    CHINESE = 'zh',
    JAPANESE = 'ja',
}
```

---

## 7. 🔄 セッション永続化ルール — 新規

### 7.1 目的

ユーザーが連続して複数のカードを作成する場合 (例: HSK1 の単語 20 個)、**新しい語彙のみを入力**すればよく、他のすべてのフィールドは前回の入力から保持されます。

### 7.2 Form ごとのセッション保存ルール

| Form Type         | セッション保存フィールド                              | 毎回リセットされるフィールド            |
| ----------------- | ----------------------------------------------- | ------------------------------- |
| **Language**      | 言語、Anki Deck、Category、Tags、Card Types | 語彙、メモ                |
| **IT Vocabulary** | Anki Deck、トピック (topics)、Difficulty          | 用語、定義、Keywords |
| **General**       | Anki Deck                                       | タイトル、コンテンツ               |

### 7.3 技術的メカニズム

```typescript
// セッション間で永続化するために localStorage を使用
interface SessionState {
    form_type: FormType;
    language?: LanguageType | null;
    anki_deck?: string | null;
    category_id?: string | null;
    tags?: string[];
    card_type_ids?: string[];
    topic_ids?: string[]; // IT form
    difficulty?: string | null; // IT form
    last_updated: string; // ISO timestamp
}

// Key: "ankiflow_session_{form_type}"
// 例: "ankiflow_session_form_language"
```

### 7.4 具体的な動作

1. **アプリを初めて開いたとき** → すべてのフィールドが空、ユーザーがすべて選択
2. **カード作成成功後** → フォームに戻る、セッションフィールドは保持、コンテンツフィールドはリセット
3. **ユーザーが Deck を変更したとき** → デックに `default_category_id` と `default_card_type_ids` があれば → 自動的に fill
4. **ユーザーが form type を変更したとき** (Language ↔ IT) → その form 固有のセッションを読み込み

---

## 8. 🎨 Admin UI — デザインシステム & コンポーネントアーキテクチャ

### 8.1 デザインシステム

**デザイン哲学:** "Calm Productivity" — ユーザーがコンテンツに集中できるよう cognitive load を減らす UI。Tactile Warmth を伴う Corporate Modern スタイル; 温かみのある紙のトーン、humanist typography。不変のタグライン: **KNOWLEDGE IN FLOW**。

**「No-Line」ルール:** セクションを区切るためにハードな `border 1px` を使用しない → tonal shift のみ使用 (背景/surface の色を変更)。

#### Color Tokens 表

| Token                    | Hex       | Tailwind key          | 用途                                |
| ------------------------ | --------- | --------------------- | --------------------------------------- |
| `primary`                | `#316342` | `primary`             | メイン CTA、active state、強調アイコン |
| `primary-container`      | `#4a7c59` | `primary-container`   | primary button の Hover                |
| `on-primary`             | `#ffffff` | —                     | primary 背景上のテキスト                   |
| `on-primary-container`   | `#e1ffe5` | `primary-text`        | primary-container 上の薄いテキスト        |
| `secondary`              | `#655d52` | `secondary`           | Supporting UI、grounding elements       |
| `secondary-container`    | `#e9ded0` | `secondary-container` | 薄い tonal fills                        |
| `tertiary`               | `#6d5622` | `tertiary`            | Flow Tips、AI highlights、Ochre accent  |
| `tertiary-container`     | `#886e38` | `tertiary-container`  | AI badges の background                |
| `tertiary-fixed`         | `#ffdea0` | `tertiary-fixed`      | AI badges の Light fill                |
| `on-tertiary-fixed`      | `#261a00` | `on-tertiary-fixed`   | tertiary-fixed 上のテキスト                |
| `background`             | `#faf6f0` | `app-bg`              | **メインページ背景 — 温かみのあるクリーム**           |
| `surface`                | `#ffffff` | —                     | Card、modal、elevated surface           |
| `surface-container-low`  | `#f1f4f1` | `surface-low`         | Sidebar background                      |
| `surface-container`      | `#ecefeb` | `surface-container`   | 薄い Hover state、input background      |
| `surface-container-high` | `#e6e9e6` | `surface-high`        | Category chips、disabled states         |
| `on-surface`             | `#181c1b` | `on-surface`          | メインテキスト                              |
| `on-surface-variant`     | `#414942` | `on-surface-var`      | サブテキスト、icon                          |
| `outline`                | `#717971` | `outline`             | デフォルト Border                         |
| `outline-variant`        | `#c1c9bf` | `outline-var`         | 薄い Border、divider                    |
| `error`                  | `#ba1a1a` | `error`               | エラー、destructive action                 |
| `error-container`        | `#ffdad6` | `error-container`     | エラー警告 background                 |
| `inverse-surface`        | `#2d312f` | `inverse-surface`     | Dark card (AI taxonomy footer)          |

#### Typography Scale 表

| レベル           | Font               | Font-size | Font-weight | Line-height | 用途                                 |
| ------------- | ------------------ | --------- | ----------- | ----------- | ---------------------------------------- |
| `display`     | Newsreader (serif) | 36px      | 700         | 1.2         | Greeting、hero title Dashboard           |
| `headline-md` | Newsreader (serif) | 24px      | 600         | 1.3         | Page title (PageHeader)                  |
| `headline-sm` | Newsreader (serif) | 18px      | 600         | 1.4         | Card title、Modal title、section heading |
| `body-md`     | Nunito Sans        | 14px      | 400         | 1.5         | すべての paragraph、description、table cell   |
| `label-lg`    | Nunito Sans        | 14px      | 700         | 1           | Button text、nav active item             |
| `label-sm`    | Nunito Sans        | 10px      | 600         | 1           | Badge text、chip uppercase、field label  |

> **フォントペアリングルール:** Headline = Newsreader serif (`font-serif`)。UI text = Nunito Sans (`font-sans`、default)。混ぜてはいけません。

#### Spacing Scale

| Token | Value | Tailwind      | 用途                           |
| ----- | ----- | ------------- | ---------------------------------- |
| `xs`  | 4px   | `p-1 / gap-1` | Internal icon padding、tight chip  |
| `sm`  | 8px   | `p-2 / gap-2` | button 内の icon-text の Gap         |
| `md`  | 16px  | `p-4 / gap-4` | Card internal padding (compact)    |
| `lg`  | 24px  | `p-6 / gap-6` | Card standard padding、section gap |
| `xl`  | 32px  | `p-8 / gap-8` | Page margin、section spacing       |

#### Border Radius Tokens

| Context                      | Radius | Tailwind       | 例                    |
| ---------------------------- | ------ | -------------- | ------------------------ |
| Card、container、panel       | 16px   | `rounded-lg`   | すべての card                 |
| Modal、large dialog          | 20px   | `rounded-xl`   | Dialog box               |
| Navigation active item       | 12px   | `rounded-md`   | Nav pill                 |
| Input、small button          | 8px    | `rounded`      | TextField、inline button |
| Badge、chip、tag、search bar | 9999px | `rounded-full` | Status chip、search      |

#### Shadow / Elevation

| Level          | Surface               | Shadow                                                           | 用途                        |
| -------------- | --------------------- | ------------------------------------------------------------------ | ------------------------------- |
| 0 — Base       | `bg-app-bg` (#faf6f0) | なし                                                         | Page background                 |
| 1 — Card       | `bg-white`            | `shadow-card` (0 4px 20px rgba(46,50,48,0.06))                   | すべての card、panel              |
| 2 — Modal      | `bg-white`            | `shadow-modal` (0 20px 50px rgba(46,50,48,0.12)) + backdrop blur | Dialog、modal focus             |
| Dark — Inverse | `bg-inverse-surface`  | なし                                                         | AI feature banner、dark callout |

---

### 8.2 UI コンポーネントアーキテクチャ

**ファイル配置:** `src/components/ui/` (shared) · `src/components/layout/` (layout) · `src/components/features/` (feature-specific)

**Naming convention:** コンポーネントファイルと export は PascalCase。`lib/utils.ts` の `cn()` helper (clsx + tailwind-merge)。Icon は `lucide-react` から。Client component (`'use client'`) は state/event/browser API がある場合のみ。

#### Atomic Design Hierarchy

| 階層                    | 説明                                     | 例                                                  |
| ----------------------- | ------------------------------------------ | -------------------------------------------------------- |
| **Atoms**               | 基本要素、これ以上分割できない | Button、Badge、Input、Toggle                           |
| **Molecules**           | 2+ atoms を組み合わせて 1 つの機能単位に    | StatCard、FormField (label + input + error)、FilterBar |
| **Organisms**           | 複合コンポーネント、独自のロジックを持つ       | NavigationSidebar、DataTable、Modal、LoadingOverlay    |
| **Templates / Layouts** | ページの骨格、具体的なデータを含まない        | app/layout.tsx (Sidebar + Main)、PageHeader            |

#### Component Library 表

| Component           | 階層     | File path                                          | 簡単な説明                                                    |
| ------------------- | -------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| `AnkiFlowLogo`      | Atom     | `components/ui/AnkiFlowLogo.tsx`                   | タグライン "KNOWLEDGE IN FLOW" を持つ Brand mark                     |
| `Button`            | Atom     | `components/ui/Button.tsx`                         | 4 variants: primary/secondary/ghost/destructive               |
| `Badge`             | Atom     | `components/ui/Badge.tsx`                          | 7 variants: neutral/active/inactive/pending/ai/language/level |
| `Toggle`            | Atom     | `components/ui/Toggle.tsx`                         | label と description を伴う on/off Switch                        |
| `ProgressBar`       | Atom     | `components/ui/ProgressBar.tsx`                    | 2 サイズ (sm/md) の進捗バー                         |
| `AIBadge`           | Atom     | `components/ui/AIBadge.tsx`                        | Sparkles icon 付きの AI Badge、tertiary-fixed 背景                |
| `ConnectedBadge`    | Atom     | `components/ui/ConnectedBadge.tsx`                 | sidebar 下部の Anki 接続状態                      |
| `FormField`         | Molecule | `components/ui/FormField.tsx`                      | Input + Textarea + Select + FieldWrapper                      |
| `TagInput`          | Molecule | `components/ui/TagInput.tsx`                       | removable badge 付きの tag 入力 Input                            |
| `StatCard`          | Molecule | `components/ui/StatCard.tsx`                       | 統計カード: label + 数値 + trend                              |
| `FlowTip`           | Molecule | `components/ui/FlowTip.tsx`                        | Lightbulb icon 付きの AI tip/callout、tertiary 背景               |
| `StepIndicator`     | Molecule | `components/ui/StepIndicator.tsx`                  | completed/active/pending 状態を持つステップリスト         |
| `Card`              | Molecule | `components/ui/Card.tsx`                           | 4 variants を持つ Container card                                 |
| `FilterBar`         | Organism | `components/ui/FilterBar.tsx`                      | Search input + active filter badges + clear all               |
| `DataTable`         | Organism | `components/ui/DataTable.tsx`                      | custom column render を持つデータテーブル                         |
| `Modal`             | Organism | `components/ui/Modal.tsx`                          | tonal header、Escape close、backdrop を持つ Dialog               |
| `LoadingOverlay`    | Organism | `components/ui/LoadingOverlay.tsx`                 | steps + progress + flow tip を持つローディング画面              |
| `NavigationSidebar` | Organism | `components/layout/NavigationSidebar.tsx`          | nav items + ConnectedBadge を含む fixed 256px Sidebar            |
| `PageHeader`        | Template | `components/layout/PageHeader.tsx`                 | breadcrumb `›`、serif title、actions slot を持つ Header          |
| `CardPreview`       | Organism | `components/features/card/CardPreview.tsx`         | 3 タブのプレビューカード: word→meaning/meaning→word/sentence       |
| `WordDetailCard`    | Organism | `components/features/history/WordDetailCard.tsx`   | border-left primary を持つ語彙詳細カード                 |
| `IntegrationCard`   | Organism | `components/features/settings/IntegrationCard.tsx` | API integration 状態カード                               |

---

### 8.3 画面リスト & 操作フロー

| 画面         | Route            | Primary Components                                                                        | Shared Components Used                                                       |
| ---------------- | ---------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Dashboard        | `/dashboard`     | `StatCard` (×4)、`EntryListItem`                                                          | `PageHeader`、`Button`、`Badge`                                              |
| 新規カード作成     | `/create`        | Form components (Language/IT/General)                                                     | `FormField`、`Select`、`Badge`、`Button`、`LoadingOverlay`、`PageHeader`     |
| Preview & Review | `/preview`       | `CardPreview`、`CollocationEditor`、`ImageSelector`、`AudioPlayer`                        | `Button`、`Badge`、`Modal`、`Input`、`PageHeader`                            |
| 履歴          | `/history`       | `HistoryTable` (`DataTable` 使用)、`WordDetailCard`                                       | `FilterBar`、`DataTable`、`Badge`、`Button`、`PageHeader`                    |
| Entry 詳細   | `/history/[id]`  | `WordDetailCard`、`CardPreview`                                                           | `Badge`、`Button`、`PageHeader`                                              |
| 管理 (Admin)  | `/admin`         | `CategoryManager`、`CardTypeManager`、`TopicManager`、`DeckManager`、`ContentTypeManager` | `DataTable`、`Modal`、`FormField`、`Toggle`、`Badge`、`Button`、`PageHeader` |
| 設定          | `/settings`      | `IntegrationCard` (×4)                                                                    | `FormField`、`Toggle`、`Button`、`PageHeader`                                |
| Layout (Root)    | `app/layout.tsx` | `NavigationSidebar`                                                                       | `AnkiFlowLogo`、`ConnectedBadge`                                             |

---

### 8.4 Screen-to-Component Mapping

### Dashboard — `/dashboard`

**Shared components:**

- `PageHeader` — font-serif display で "Control Center" の greeting を表示
- `Button` variant `primary` — Quick action "新規カード作成" → `/create`
- `Badge` — 各最近の entry に language/status を表示
- `ProgressBar` — (オプション) 週次学習進捗を表示

**Screen-specific components:**

- `StatCard` (`components/ui/StatCard.tsx`) — 4 カラムグリッド: Total Vocabulary、Total Cards、Created Today、Success Rate
- `EntryListItem` (`components/history/EntryListItem.tsx`) — 最近 10 単語リスト内の 1 entry 行

**管理する必要のある State:**

- `stats`: `{ totalVocab: number; totalCards: number; todayCount: number }` — Firestore から fetch
- `recentEntries`: `Entry[]` — 最新 10 entries

---

### 新規カード作成 — `/create`

**Shared components:**

- `LoadingOverlay` — generate 中に表示 (3 steps: Claude → TTS → Unsplash)
- `PageHeader` — breadcrumb: Home › Create Card › [Form type]
- `Button` variant `primary` — "下書きを作成"
- `FormField` (Input/Textarea/Select) — すべての form fields
- `Badge` variant `language` — 選択中の言語を表示
- `FlowTip` — ユーザー向け AI 提案

**Screen-specific components:**

- `DeckSelector` (`components/create/DeckSelector.tsx`) — FormField の `Select` を使用
- `CategorySelector` (`components/create/CategorySelector.tsx`) — FormField の `Select` を使用
- `LanguageSelector` (`components/create/LanguageSelector.tsx`) — Badge 付き 3 options
- `CardTypeSelector` (`components/create/CardTypeSelector.tsx`) — checkbox list + Toggle
- `TopicSelector` (`components/create/TopicSelector.tsx`) — IT form のみ、Badge active/neutral
- `LanguageForm` / `ITForm` / `GeneralForm` — 各 content type に対応する form

**管理する必要のある State:**

- `formType`: `FormType` — deck から検出または手動選択
- `sessionState`: `SessionState` — localStorage から読み込み、変更時に auto-save
- `isGenerating`: `boolean` — LoadingOverlay を制御
- `generationSteps`: `Step[]` — 各 generate ステップの状態

---

### Preview & Review — `/preview`

**Shared components:**

- `PageHeader` — breadcrumb: Home › Create Card › Preview
- `Button` variant `primary` — "確認 & 作成"
- `Button` variant `ghost` — "戻る"、"画像を再検索"
- `Modal` — Anki notes 作成前の確認
- `Badge` — level、word type

**Screen-specific components:**

- `EditableField` (`components/preview/EditableField.tsx`) — Input/Textarea による click-to-edit
- `CollocationEditor` (`components/preview/CollocationEditor.tsx`) — `Badge` + `@dnd-kit/core` を使用
- `ImageSelector` (`components/preview/ImageSelector.tsx`) — 5 画像のグリッド、選択時 ring-primary
- `AudioPlayer` (`components/preview/AudioPlayer.tsx`) — play/stop/regenerate
- `CardPreview` (`components/features/card/CardPreview.tsx`) — 3 タブ front/back プレビュー
- `CardList` (`components/preview/CardList.tsx`) — Toggle 付き card types グリッド

**管理する必要のある State:**

- `previewData`: `Entry` — Create page から生成されたデータ
- `selectedImage`: `UnsplashImage | null`
- `selectedCardTypes`: `string[]` — 選択された card type
- `confirmModalOpen`: `boolean`

---

### 履歴 — `/history`

**Shared components:**

- `PageHeader` — title "語彙履歴"
- `DataTable` — メインテーブル (新しい table を作成しない)
- `FilterBar` — search + filter + active filter badges
- `Badge` — entry 状態 (active/inactive/pending)
- `Button` — 各 row 内のアクション

**Screen-specific components:**

- `HistoryTable` (`components/history/HistoryTable.tsx`) — 特定 columns を持つ `DataTable` の wrapper
- `WordDetailCard` (`components/features/history/WordDetailCard.tsx`) — `/history/[id]` 詳細ページ

**管理する必要のある State:**

- `entries`: `Entry[]` — Firestore からのリスト (pagination あり)
- `searchQuery`: `string`
- `activeFilters`: `ActiveFilter[]` — category、language、deck、date range
- `currentPage`: `number`

---

### 管理 (Admin) — `/admin`

**Shared components:**

- `PageHeader` — title "Control Center" with `actions` = "新規追加" ボタン
- `DataTable` — すべての Manager component が共有 (table logic を重複させない)
- `Modal` — record の追加/編集フォーム
- `FormField` (Input/Select) — Modal 内
- `Toggle` — is_active、is_default スイッチ
- `Badge` — active/inactive 状態
- `Button` variant `primary` — "保存"、`ghost` — "キャンセル"、`destructive` — "削除"

**Screen-specific components:**

- `CategoryManager` (`components/admin/CategoryManager.tsx`)
- `CardTypeManager` (`components/admin/CardTypeManager.tsx`)
- `TopicManager` (`components/admin/TopicManager.tsx`)
- `DeckManager` (`components/admin/DeckManager.tsx`)
- `ContentTypeManager` (`components/admin/ContentTypeManager.tsx`)

**管理する必要のある State:**

- `activeTab`: `'categories' | 'card-types' | 'topics' | 'decks' | 'content-types'`
- `modalOpen`: `boolean`
- `editingRecord`: `Category | CardTypeConfig | Topic | DeckConfig | null`
- `isLoading`: `boolean` — CRUD operations

---

### 設定 — `/settings`

**Shared components:**

- `PageHeader` — title "Settings" with description
- `FormField` (Input) — AnkiConnect URL
- `FormField` (Select) — Claude model
- `Toggle` — unsplash_enabled、tts_enabled
- `Button` variant `primary` — "変更を保存"
- `Button` variant `ghost` — "Test connection"

**Screen-specific components:**

- `IntegrationCard` (`components/features/settings/IntegrationCard.tsx`) — 各 API を表示: AnkiConnect、Claude、Google TTS、Unsplash

**管理する必要のある State:**

- `settings`: `Settings` — Firestore `settings` collection から読み込み
- `connectionStatus`: `Record<string, 'active' | 'inactive' | 'pending'>`
- `isSaving`: `boolean`

---

### Layout (Root) — `app/layout.tsx`

**Shared components:**

- `NavigationSidebar` — fixed w-64 sidebar、`AnkiFlowLogo` + nav items + `ConnectedBadge` を含む
- `ConnectedBadge` — sidebar 下部、30 秒ごとに AnkiConnect を polling

**管理する必要のある State:**


- `ankiConnected`: `boolean` — global state、`/api/anki/connect` から poll

## 9. 🃏 Anki Card Templates — 新デザイン

### 9.1 デザイン原則

1. **主要コンテンツを目立たせる:** 語彙 + 意味は最も大きく、明確で、読みやすくする
2. **視覚的階層:** サイズ、色、間隔を使って hierarchy を作る
3. **目を引き、興味を持たせる:** 軽いグラデーション、丸み、color accents
4. **安全なフォント:** CJK characters (Noto Sans SC、Noto Sans JP) には必ず fallback を用意
5. **明確な Collocations:** context の中で覚えられるようによく共起するフレーズを表示

### 9.2 すべての Anki cards に共通の CSS

```css
/* ============================================
   AnkiFlow Card Styles — v1.1
   サポート: 中国語、日本語、英語、IT
   ============================================ */

/* Google Fonts の import — フォントエラーを防ぐ */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&display=swap');

/* === グローバル CSS 変数 === */
.card {
    --color-primary: #0061a4; /* Primary */
    --color-primary-light: #2196f3;
    --color-accent: #f59e0b; /* Amber */
    --color-bg: #f7f9fb; /* Light background */
    --color-card-bg: #ffffff; /* Surface lowest */
    --color-card-border: transparent; /* No-line rule */
    --color-text: #191c1e; /* On surface */
    --color-text-muted: #515f74; /* Secondary */
    --color-success: #006c49; /* Tertiary */
    --color-han-viet: #8b5cf6; /* Violet */
    --color-example: #0284c7; /* Sky */
    --color-collocation: #ea580c; /* Orange */
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

/* === メイン語彙 (最も目立つ) === */
.word-main {
    font-size: 56px;
    font-weight: 700;
    color: var(--color-text);
    text-align: center;
    margin-bottom: 8px;
    line-height: 1.2;
    letter-spacing: 2px;
}

/* === 発音記号 (Pinyin / Hiragana / IPA) === */
.reading {
    font-size: 20px;
    color: var(--color-primary-light);
    text-align: center;
    margin-bottom: 4px;
    font-weight: 500;
}

/* === ハンベトナム音 === */
.han-viet {
    font-size: 15px;
    color: var(--color-han-viet);
    text-align: center;
    margin-bottom: 16px;
    font-style: italic;
}

/* === ベトナム語の意味 (2 番目に目立つ) === */
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

/* === 品詞 badge === */
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

/* === レベル badge === */
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

/* === 区切り線 === */
.divider {
    border: none;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--color-card-border), transparent);
    margin: 20px 0;
}

/* === 画像 === */
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

/* === 例文 === */
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

/* === よく共起するフレーズ (Collocations) === */
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
    content: '•';
    color: var(--color-collocation);
    margin-right: 8px;
    font-weight: bold;
}

/* === Audio ボタン === */
.audio-section {
    text-align: center;
    margin: 12px 0;
}

/* === Prompt/Hint テキスト === */
.hint-text {
    font-size: 15px;
    color: var(--color-text-muted);
    text-align: center;
    font-style: italic;
    margin: 20px 0;
}

/* === IT Card 固有 === */
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

### 9.3 Template: 言語 — 単語 → 意味

**Front:**

```html
<div class="card-container">
    <div class="word-main">{{Word}}</div>
    <div class="reading">{{Pinyin}}</div>
    {{#HanViet}}
    <div class="han-viet">HV: {{HanViet}}</div>
    {{/HanViet}}
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
    {{#HanViet}}
    <div class="han-viet">HV: {{HanViet}}</div>
    {{/HanViet}}
    <div class="audio-section">{{Audio}}</div>

    <hr class="divider" />

    {{#Image}}
    <div class="image-container">{{Image}}</div>
    {{/Image}}

    <div class="meaning">{{MeaningVI}}</div>

    {{#ExampleSentence}}
    <div class="example-box">
        <div class="example-sentence">{{ExampleSentence}}</div>
        <div class="example-audio">{{ExampleAudio}}</div>
        <div class="example-translation">{{ExampleTranslation}}</div>
    </div>
    {{/ExampleSentence}} {{#Collocations}}
    <div class="collocations-box">
        <div class="collocations-title">よく共起するフレーズ</div>
        {{Collocations}}
    </div>
    {{/Collocations}}
</div>
```

### 9.4 Template: 言語 — 意味 → 単語

**Front:**

```html
<div class="card-container">
    <div class="meaning">{{MeaningVI}}</div>
    {{#Image}}
    <div class="image-container">{{Image}}</div>
    {{/Image}}
    <div class="hint-text">これは何という単語?</div>
</div>
```

**Back:**

```html
<div class="card-container">
    <div class="word-main">{{Word}}</div>
    <div class="reading">{{Pinyin}}</div>
    {{#HanViet}}
    <div class="han-viet">HV: {{HanViet}}</div>
    {{/HanViet}}
    <div class="audio-section">{{Audio}}</div>

    <hr class="divider" />

    <div class="meaning">{{MeaningVI}}</div>

    {{#ExampleSentence}}
    <div class="example-box">
        <div class="example-sentence">{{ExampleSentence}}</div>
        <div class="example-audio">{{ExampleAudio}}</div>
        <div class="example-translation">{{ExampleTranslation}}</div>
    </div>
    {{/ExampleSentence}} {{#Collocations}}
    <div class="collocations-box">
        <div class="collocations-title">よく共起するフレーズ</div>
        {{Collocations}}
    </div>
    {{/Collocations}}
</div>
```

### 9.5 Template: リスニング → 単語当て

**Front:**

```html
<div class="card-container">
    <div class="audio-section" style="margin: 40px 0;">
        <div style="font-size: 64px; margin-bottom: 20px;">🔊</div>
        {{Audio}}
    </div>
    <div class="hint-text">聞いて単語を当てよう...</div>
</div>
```

**Back:**

```html
<div class="card-container">
    <div class="word-main">{{Word}}</div>
    <div class="reading">{{Pinyin}}</div>
    {{#HanViet}}
    <div class="han-viet">HV: {{HanViet}}</div>
    {{/HanViet}}
    <div class="audio-section">{{Audio}}</div>

    <hr class="divider" />

    {{#Image}}
    <div class="image-container">{{Image}}</div>
    {{/Image}}
    <div class="meaning">{{MeaningVI}}</div>

    {{#ExampleSentence}}
    <div class="example-box">
        <div class="example-sentence">{{ExampleSentence}}</div>
        <div class="example-translation">{{ExampleTranslation}}</div>
    </div>
    {{/ExampleSentence}} {{#Collocations}}
    <div class="collocations-box">
        <div class="collocations-title">よく共起するフレーズ</div>
        {{Collocations}}
    </div>
    {{/Collocations}}
</div>
```

### 9.6 Template: 画像を見て → 単語当て

**Front:**

```html
<div class="card-container">
    <div class="image-container" style="margin: 20px 0;">{{Image}}</div>
    <div class="hint-text">この画像を表す単語は?</div>
</div>
```

**Back:**

```html
<div class="card-container">
    <div class="image-container">{{Image}}</div>

    <hr class="divider" />

    <div class="word-main">{{Word}}</div>
    <div class="reading">{{Pinyin}}</div>
    {{#HanViet}}
    <div class="han-viet">HV: {{HanViet}}</div>
    {{/HanViet}}
    <div class="audio-section">{{Audio}}</div>
    <div class="meaning">{{MeaningVI}}</div>
</div>
```

### 9.7 Template: 穴埋め

**Front:**

```html
<div class="card-container">
    <div class="example-box" style="border-left-color: var(--color-primary);">
        <div class="example-sentence" style="font-size: 22px;">{{ExampleBlank}}</div>
    </div>
    <div class="example-translation" style="text-align: center; margin-top: 12px;">{{ExampleTranslation}}</div>
    <div class="hint-text">欠けている単語を入力...</div>
</div>
```

**Back:**

```html
<div class="card-container">
    <div class="word-main">{{Word}}</div>
    <div class="reading">{{Pinyin}}</div>
    {{#HanViet}}
    <div class="han-viet">HV: {{HanViet}}</div>
    {{/HanViet}}
    <div class="audio-section">{{Audio}}</div>

    <hr class="divider" />

    <div class="example-box">
        <div class="example-sentence">{{ExampleSentence}}</div>
        <div class="example-audio">{{ExampleAudio}}</div>
        <div class="example-translation">{{ExampleTranslation}}</div>
    </div>

    <div class="meaning">{{MeaningVI}}</div>
</div>
```

### 9.8 Template: Pinyin/Hiragana → 原字

**Front:**

```html
<div class="card-container">
    <div class="reading" style="font-size: 36px; margin: 20px 0;">{{Pinyin}}</div>
    <div class="meaning" style="font-size: 18px;">{{MeaningVI}}</div>
    <div class="hint-text">漢字/Kanji で書いてください...</div>
</div>
```

**Back:**

```html
<div class="card-container">
    <div class="word-main">{{Word}}</div>
    <div class="reading">{{Pinyin}}</div>
    {{#HanViet}}
    <div class="han-viet">HV: {{HanViet}}</div>
    {{/HanViet}}
    <div class="audio-section">{{Audio}}</div>

    <hr class="divider" />

    <div class="meaning">{{MeaningVI}}</div>

    {{#Collocations}}
    <div class="collocations-box">
        <div class="collocations-title">よく共起するフレーズ</div>
        {{Collocations}}
    </div>
    {{/Collocations}}
</div>
```

### 9.9 Template: IT — 概念 → 定義

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
    <div style="text-align: center;">{{#Topic}}<span class="topic-badge">{{Topic}}</span>{{/Topic}}</div>

    <hr class="divider" />

    {{#Image}}
    <div class="image-container">{{Image}}</div>
    {{/Image}}

    <div class="definition">{{Definition}}</div>

    {{#Analogy}}
    <div class="analogy-box">💡 {{Analogy}}</div>
    {{/Analogy}} {{#ExampleUsage}}
    <div class="example-box">
        <div class="example-sentence">{{ExampleUsage}}</div>
    </div>
    {{/ExampleUsage}}

    <div class="keywords-list">{{#Keywords}}<span class="keyword-tag">{{Keywords}}</span>{{/Keywords}}</div>
</div>
```

### 9.10 Template: IT — 定義 → 概念

**Front:**

```html
<div class="card-container">
    <div class="definition">{{DefinitionShort}}</div>
    {{#Topic}}
    <div style="text-align: center;"><span class="topic-badge">{{Topic}}</span></div>
    {{/Topic}}
    <div class="hint-text">どの用語?</div>
</div>
```

**Back:**

```html
<div class="card-container">
    <div class="term-main">{{Term}}</div>

    <hr class="divider" />

    <div class="definition">{{Definition}}</div>

    {{#Analogy}}
    <div class="analogy-box">💡 {{Analogy}}</div>
    {{/Analogy}}
</div>
```

---

## 10. 🤖 AI Prompt Specifications — v1.1 更新

### 10.1 中国語用 Prompt

```
あなたはベトナム人のための中国語言語専門家です。
単語 "{{WORD}}" について、以下の JSON format で情報を提供してください。

重要な要件:
- 例文は簡潔 (10 語以下)、理解しやすく、文法が正しく、日常的な自然言語である必要があります。
- Collocations: よく共起する 3-5 の句/量詞を提供し、ベトナム語の意味を添える。
  例 醋: "蘸点儿醋 (酢を少しつける)", "白醋 (白酢)", "吃醋 (嫉妬する)"
- 名詞の場合: 適切な量詞を追加。例: 一本书, 一杯水

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

### 10.2 日本語用 Prompt

```
あなたはベトナム人のための日本語言語専門家です。
単語 "{{WORD}}" について、以下の JSON format で情報を提供してください。

重要な要件:
- 例文は簡潔 (10 語以下)、理解しやすく、文法が正しく、自然言語である必要があります。
- Collocations: よく共起する 3-5 の句/助詞を提供し、ベトナム語の意味を添える。
  例 本: "本を読む (本を読む)", "一冊の本 (1 冊の本)"
- 外来語の場合は Katakana を使用。

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

### 10.3 英語用 Prompt

```
あなたはベトナム人のための英語言語専門家です。
単語 "{{WORD}}" について、JSON format で情報を提供してください。

重要な要件:
- 例文は簡潔 (12 語以下)、理解しやすく、自然である必要があります。
- Collocations: よく使われる 3-5 の句/collocation を提供し、ベトナム語の意味を添える。
  例 "book": "book a flight (チケットを予約する)", "read a book (本を読む)"

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

### 10.4 IT Vocabulary 用 Prompt

```
あなたはベトナム人プログラマーのための IT 専門家です。
分野 "{{TOPICS}}" における用語 "{{TERM}}" について、以下を提供してください:

要件:
- definition_vi: 詳細であるが明確で、理解しやすい説明
- definition_short: 1 文の超短い定義
- analogy_vi: 日常的な例えを使って覚えやすくする
- example_usage: 現実的で簡潔な例

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

## 11. 🔌 API 統合仕様

### 11.1 AnkiConnect API

**Base URL:** `http://localhost:8765`  
**Action バージョン:** 6

**新規 Note の作成:**

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

**接続確認:**

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
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// AI agent: model に tool `submit_card` の呼び出しを強制 → 正しいスキーマの structured output
const res = await client.messages.create({
    model: 'claude-haiku-4-5', // settings.ai_model から取得
    max_tokens: 4096,
    temperature: 0.3,
    system: systemPrompt,
    tools: [{ name: 'submit_card', description, input_schema: cardInputSchema }],
    tool_choice: { type: 'tool', name: 'submit_card' },
    messages: [{ role: 'user', content: userMessage }],
});

const toolUse = res.content.find((b) => b.type === 'tool_use');
const content = cardSchema.parse(toolUse.input); // zod で validate
```

### 11.3 Google Cloud TTS

// 重要: generate と store を 2 つの独立したステップに分離。
// /api/audio/generate と /api/audio/store を参照。
// /api/audio ルートは backward-compatible のため維持。

```typescript
import textToSpeech from '@google-cloud/text-to-speech';

const client = new textToSpeech.TextToSpeechClient();

// 中国語
const request = {
    input: { text: '书' },
    voice: { languageCode: 'zh-CN', name: 'zh-CN-Wavenet-A' },
    audioConfig: { audioEncoding: 'MP3' },
};

// 日本語: { languageCode: "ja-JP", name: "ja-JP-Wavenet-A" }
// 英語: { languageCode: "en-US", name: "en-US-Wavenet-F" }
```

### 11.4 Unsplash API

```typescript
const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${keyword}&per_page=5&orientation=squarish`,
    { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } },
);
```

---

## 12. 📁 プロジェクト構造 — 更新

```
ankiflow/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Root layout (NavigationSidebar + main)
│   ├── page.tsx                      # Home / redirect
│   ├── globals.css                   # Tailwind v4 @theme tokens
│   ├── dashboard/page.tsx            # Stats overview, recent entries
│   ├── create/page.tsx               # Create card form
│   ├── preview/page.tsx              # Preview & review, export to Anki
│   ├── history/
│   │   ├── page.tsx                  # History list
│   │   └── [id]/page.tsx             # Entry detail
│   ├── admin/page.tsx                # CRUD categories, topics, card types, decks, content types
│   ├── settings/page.tsx             # Settings & integrations
│   ├── verify/                       # Runtime verification dashboard (dev only)
│   │   ├── page.tsx
│   │   └── [unitId]/[fixtureId]/page.tsx
│   └── api/
│       ├── generate/route.ts         # Claude AI agent → コンテンツ生成
│       ├── audio/
│       │   ├── route.ts              # TTS + store combined (backward-compat)
│       │   ├── generate/route.ts     # TTS only → base64
│       │   └── store/route.ts        # Store base64 → Anki media
│       ├── image/route.ts            # Unsplash image search
│       ├── anki/
│       │   ├── connect/route.ts      # AnkiConnect チェック
│       │   ├── create/route.ts       # notes 作成 + Firestore 保存
│       │   ├── decks/route.ts        # decks リスト取得
│       │   └── update/route.ts       # notes + Firestore entry 更新
│       ├── entries/
│       │   └── check-duplicate/route.ts  # 重複語チェック
│       ├── history/
│       │   ├── route.ts              # GET/POST entries
│       │   └── [id]/route.ts         # GET/PUT/DELETE entry
│       └── admin/
│           ├── categories/route.ts
│           ├── card-types/route.ts
│           ├── topics/route.ts
│           ├── decks/route.ts
│           └── content-types/route.ts
│
├── components/
│   ├── layout/
│   │   ├── NavigationSidebar.tsx      # Sidebar fixed w-64 + nav + ConnectedBadge
│   │   └── PageHeader.tsx             # Breadcrumb, title, actions slot
│   ├── ui/                            # Shared UI primitives
│   │   ├── AnkiFlowLogo.tsx, Badge.tsx, Button.tsx, Card.tsx
│   │   ├── ConnectedBadge.tsx, DataTable.tsx, EmptyState.tsx
│   │   ├── ErrorMessage.tsx, FilterBar.tsx, FlowTip.tsx
│   │   ├── FormField.tsx, LoadingOverlay.tsx, Modal.tsx
│   │   ├── ProgressBar.tsx, StatCard.tsx, StepIndicator.tsx
│   │   ├── Tabs.tsx, TagInput.tsx, Toggle.tsx
│   │   └── ...
│   ├── create/
│   │   ├── LanguageForm.tsx, ITForm.tsx, GeneralForm.tsx
│   │   ├── DynamicForm.tsx            # Render arbitrary content type
│   │   ├── CategorySelector.tsx, DeckSelector.tsx
│   │   ├── LanguageSelector.tsx, CardTypeSelector.tsx
│   │   ├── TopicSelector.tsx
│   │   ├── SmartEnrichmentBanner.tsx  # AI generation progress
│   │   ├── ColumnLabel.tsx, SectionDivider.tsx
│   │   └── ...
│   ├── preview/
│   │   ├── CardPreview.tsx, CardList.tsx
│   │   ├── EditableField.tsx, CollocationEditor.tsx
│   │   ├── ImageSelector.tsx, AudioPlayer.tsx
│   │   └── ...
│   ├── history/
│   │   ├── HistoryTable.tsx
│   │   ├── WordDetailCard.tsx
│   │   └── EntryEditModal.tsx         # Edit + re-export existing entry
│   └── admin/
│       ├── CategoryManager.tsx, CardTypeManager.tsx
│       ├── TopicManager.tsx, DeckManager.tsx
│       └── ContentTypeManager.tsx
│
├── hooks/
│   ├── useSession.ts                  # Form session persistence (localStorage)
│   ├── usePreviewEntry.ts             # Load pending entry for preview
│   ├── useAnkiExport.ts               # Export orchestration (Anki + Firestore)
│   ├── useDuplicateCheck.ts           # Duplicate word detection
│   └── useEntryEdit.ts                # Edit existing entry + re-export
│
├── lib/
│   ├── firebase.ts                    # Client SDK init
│   ├── firebase-admin.ts              # Admin SDK init
│   ├── ai-agent/                      # Claude AI agent
│   │   ├── index.ts                   # Factory + model constants
│   │   ├── claude-agent-provider.ts   # Tool-forced + web search modes
│   │   ├── card-schemas.ts            # Zod schemas per language/type
│   │   └── types.ts
│   ├── flashcard-service/             # AnkiConnect abstraction
│   │   ├── index.ts
│   │   ├── anki-connect-provider.ts
│   │   └── types.ts
│   ├── prompts/                       # Per-language system prompts
│   │   ├── chinese.ts, japanese.ts, english.ts, it-vocab.ts
│   ├── audio-service.ts               # TTS generate + Anki store helpers
│   ├── session.ts                     # Session persistence logic
│   ├── pendingEntry.ts                # Temp storage (create → preview)
│   ├── tts.ts                         # Google Cloud TTS wrapper
│   ├── unsplash.ts                    # Unsplash API wrapper
│   ├── constants.ts                   # LOCAL_USER_ID, form type mappings
│   ├── validation.ts                  # Zod schemas for API request bodies
│   ├── auth-guard.ts                  # x-api-secret header verification
│   ├── api-response.ts                # apiSuccess / apiError helpers
│   ├── firestore-helpers.ts           # Firestore query helpers
│   └── utils.ts                       # cn() utility (clsx + tailwind-merge)
│
├── types/
│   └── index.ts                       # All TypeScript types and enums
│
├── verify/                            # Runtime verification framework
│   ├── core/                          # Engine (contract, registry, runner)
│   ├── harness/                       # Firebase/Firestore stubs for testing
│   ├── specs/                         # Component specs (50+ .verify.tsx files)
│   ├── unit/                          # Unit tests (session, pendingEntry, AI schemas)
│   └── matrix.test.ts                 # Integration test matrix
│
├── scripts/
│   ├── seed-firestore.ts              # Seed initial data
│   ├── setup-anki.js                  # Anki setup helper
│   └── migrate-form-type.ts           # Migration scripts
│
├── .env.example
└── README.md
```

---

## 13. 🔑 環境変数

```bash
# .env

# Firebase (Admin SDK — server-side)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Firebase (Client SDK — browser)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Anthropic Claude
ANTHROPIC_API_KEY=

# Google Cloud TTS
GOOGLE_TTS_API_KEY=

# Unsplash
UNSPLASH_ACCESS_KEY=

# AnkiConnect
ANKI_CONNECT_URL=http://localhost:8765

# Security
API_SECRET=                    # /api/admin/* と /api/history/* 用の x-api-secret header
```

---

## 14. 💰 コスト分析

| サービス                | Free Tier                                    | 想定使用量                 | コスト                                         |
| ---------------------- | -------------------------------------------- | ---------------------------- | ----------------------------------------------- |
| **Firebase Firestore** | 1GB storage、50K reads/日、20K writes/日 | ~300MB (300K cards + config) | $0                                              |
| **Firebase Storage**   | 5GB                                          | ほぼ未使用           | $0                                              |
| **Claude Haiku 4.5**   | 有料 (~$1/$5 per 1M tokens in/out)        | ~1 call/カード (~1-2K tokens)   | ~数セント / 100 カード                             |
| **Google Cloud TTS**   | 100 万文字/月 (WaveNet)                     | ~100-500 文字/card          | $0                                              |
| **Unsplash API**       | 50 requests/時間 (Demo)                       | 1 request/card               | $0                                              |
| **AnkiConnect**        | 無料、open-source                        | -                            | $0                                              |
| **AnkiWeb sync**       | 無料                                     | -                            | $0                                              |
| **Hosting**            | Localhost                                    | -                            | $0                                              |
| **合計**               |                                              |                              | **~$0/月 + Claude のトークン課金 (非常に小さい)** |

> **注記:** カード数が 400K+ を超える場合、Firestore storage コストが ~$0.07-$0.18/月 発生する可能性があります。

---

## 15. 🚧 制限 & リスク

| リスク                                 | 深刻度        | 対策                                                             |
| --------------------------------------- | ------------- | --------------------------------------------------------------------- |
| AnkiConnect が応答しない             | 高           | Anki を起動する手順を表示、retry mechanism                          |
| Claude が誤ったスキーマの output を返す           | 低          | Tool `submit_card` でスキーマ強制 + zod validate + retry                   |
| Unsplash で適切な画像が見つからない    | 中    | 別のキーワード入力を許可、画像をスキップ                                |
| Google TTS rate limit                  | 低          | Queue、delay 付き retry                                                |
| Firestore オフライン                      | 低          | ローカル Cache、後で sync                                                 |
| 既に作成済みの単語の重複                        | 中    | 作成前に Firestore 内をチェック                                |
| Anki mobile での CJK フォントエラー          | 中    | fallback chain 付き Google Fonts (Noto Sans SC/JP) を使用                |
| Google TTS rate limit / quota 浪費 | 軽減済み | generate/store route を分離 — TTS quota を消費せず store を retry 可能 |

---

## 16. 🛣️ ロードマップ

### Phase 1 — MVP (現在のプロジェクト)

- [x] PRD 設計
- [ ] プロジェクトセットアップ (Next.js + Firebase + API keys)
- [ ] Anki Note Types/Templates の作成
- [ ] Admin page: categories、topics、card types、decks の CRUD
- [ ] Create form + Session persistence
- [ ] Preview & Review + Confirm
- [ ] Claude API 統合 — AI agent tool-based (collocations 付き)
- [ ] Google TTS 統合
- [ ] Unsplash 統合
- [ ] AnkiConnect 統合
- [ ] Firestore への履歴保存
- [ ] Dashboard + History view

### Phase 2 — 改善

- [ ] Batch import (CSV/txt ファイルから複数の単語を同時に)
- [ ] 作成済み entry の Review/編集
- [ ] 学習統計 (どのカードが復習中か、進捗)
- [ ] 直感的な Template editor (card design のカスタマイズ)
- [ ] Export/import data
- [ ] 高度な Content type editor (drag & drop fields)

### Phase 3 — 拡張 (将来)

- [ ] 個人用 iOS/Android アプリ (Anki の代替)
- [ ] AnkiWeb 不要の直接 Sync
- [ ] 次に学習すべき単語の AI 提案
- [ ] Obsidian/Notion との統合

---

## 17. ✅ MVP 完了基準

- [ ] 中国語カードが完全に作成できる: 漢字、Pinyin、ハンベトナム音、VN 意味、簡潔な例文、collocations、audio、画像
- [ ] 日本語カードが作成できる: Kanji、Hiragana、Romaji、VN 意味、例文、collocations、audio、画像
- [ ] 英語カードが作成できる: 単語、IPA、VN 意味、例文、collocations、audio、画像
- [ ] IT Vocabulary カードが作成できる: 用語、定義、analogy、keywords、画像
- [ ] 作成前に Review、各 field を編集可能
- [ ] カード表示が美しく、目を引き、あらゆるデバイスでフォントエラーがない
- [ ] Session persistence: 新しい単語入力のみで、固定 field の再選択不要
- [ ] Admin ページ: categories、topics、card types、decks を管理
- [ ] カードが Anki Desktop に正しく表示される
- [ ] sync 後 iPad で学習可能
- [ ] 履歴が Firestore に保存される
- [ ] コスト $0/月
