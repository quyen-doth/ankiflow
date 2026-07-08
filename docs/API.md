# 📚 API リファレンス — AnkiFlow Backend

このドキュメントは AnkiFlow プロジェクトで使用されるバックエンド API ルートの詳細な仕様を提供します。システムは Next.js App Router で構築されており、Client (React UI) と外部サービス (Firestore、Claude、Google TTS、Unsplash) を接続する仲介役を果たします。

> **⚡ AnkiConnect アーキテクチャ (2026-07-04 以降):** すべての AnkiConnect コマンドは **クライアント側で実行** — ユーザーのブラウザが `lib/flashcard-service/client.ts` + `client-ops.ts` 経由で自分の `localhost:8765` を直接呼び出します。**サーバーは AnkiConnect を呼び出さない** (Vercel 上ではサーバーの localhost がユーザーのマシンではない)。残りの `/api/anki/*` ルートはもっぱら Firestore を読み書きし、クライアントが Anki を操作するためのデータを返します。ユーザーはアプリの origin を AnkiConnect アドオン設定内の `webCorsOriginList` に追加する必要があります (`docs/REFERENCE.md` 参照)。

---

## 1. 🏗️ アーキテクチャ図 (Architecture Flow)

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
        AnkiConnect[AnkiConnect plugin — ユーザーの localhost:8765]
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

**Anki 操作の共通パターン:** サーバーがデータを返す (GET/POST) → ブラウザが AnkiConnect コマンドを実行 → ブラウザが結果をサーバーに報告して Firestore を更新。

---

## 2. 📝 規約

すべての API ルートは以下の規約に従います:

- **Base URL:** `http://localhost:3000` (ローカル環境)
- **データ形式:** Request (POST/PUT) と Response はともに `application/json` 形式を使用。
- **レスポンス形式 (成功時):**
  結果を含む JSON object を返します。書き込み操作では `success: true` フラグが付く場合があります。
    ```json
    {
        "success": true,
        "id": "abc123xyz"
    }
    ```
- **エラー形式 (失敗時):**
  常に `error` キーを持つ object を返し、エラーメッセージと対応する HTTP ステータスコードが付きます。
    ```json
    {
        "error": "Missing required fields"
    }
    ```
- **一般的な HTTP ステータスコード:**
    - `200 OK`: リクエスト成功。
    - `400 Bad Request`: Payload またはクエリパラメータが不足またはフォーマットが誤り。
    - `404 Not Found`: リソースが存在しない (例: Document ID)。
    - `500 Internal Server Error`: サーバーエラーまたは外部サービスが失敗。
    - `503 Service Unavailable`: 依存サービスが応答しない (例: AnkiConnect が起動していない)。

---

## 3. 🔐 認証 & 認可 (Firebase Auth — マルチユーザー)

AnkiFlow は **Firebase Authentication (メール/パスワード) + httpOnly セッションクッキー `__session`** を使用。
ミドルウェアはクッキーの存在のみをチェック (Edge は Admin SDK を実行できない); **実際の検証** (`verifySessionCookie`)
は各 API ルートで `withAuth`/`verifySessionUser` (`lib/auth-guard.ts`) 経由で行われ、ハンドラーパラメータとして UID を返す。

| ルートグループ | 認証 | 注記 |
| --- | --- | --- |
| `/api/auth/*` | Public | session (ログイン)、サインアップ、ログアウト — ログイン前に実行 |
| `/api/notifications/line-webhook` | Public (LINE 署名) | LINE プラットフォームが外部から呼び出し |
| `/api/entries/*`、`/api/anki/*`、`/api/history/*`、`/api/generate`、`/api/audio/generate`、`/api/image` | **`withAuth`** (セッションクッキー) → 不足/不正時 401 | UID に基づいてデータをスコープ |
| `/api/admin/global-config` (POST)、`/api/notifications/send` | セッションクッキー **+ `email === ADMIN_EMAIL`** → 管理者でない場合 403 | コントロールプレーン |
| `/api/admin/*` (CRUD レガシー) | `withAuth` | クライアントコーラーなし (UI は Client SDK を使用) |

**データの分離:** すべての `entries` + マスターデータクエリが `user_id == uid` でフィルタリング; ミューテーション時の所有権チェック (別のユーザーのエントリを更新/削除 → 404)。最後のレイヤーは **Firestore Security Rules** (Client SDK)。

**管理者 (2 つの独立したメカニズム):** サーバーは env `ADMIN_EMAIL` を使用; Firestore ルールはカスタムクレーム
`admin:true` を使用。`NEXT_PUBLIC_ADMIN_EMAIL` は UI ゲートのみ。

---

## 4. ⚙️ 環境変数

API が機能するために必要な環境変数のマッピング表 (`.env` で設定):

| 環境変数                         | 対応するサービス                   | 使用されるルート                                                   |
| -------------------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`              | Anthropic Claude API               | `/api/generate`                                                   |
| `GOOGLE_APPLICATION_CREDENTIALS` | Google Cloud Service Account (TTS) | `/api/audio/generate`                                             |
| `UNSPLASH_ACCESS_KEY`            | Unsplash Developer API             | `/api/image`                                                      |
| `FIREBASE_ADMIN_PROJECT_ID`      | Firebase Admin SDK (Auth + Firestore) | `withAuth` を持つすべてのルート + `/api/auth/*`                 |
| `FIREBASE_ADMIN_CLIENT_EMAIL`    | Firebase Admin SDK                 | (上に同じ)                                                        |
| `FIREBASE_ADMIN_PRIVATE_KEY`     | Firebase Admin SDK                 | (上に同じ)                                                        |
| `ADMIN_EMAIL`                    | サーバー側管理者判定               | `/api/admin/global-config`、`/api/notifications/send`、サインアップ (クレーム設定) |
| `NEXT_PUBLIC_ADMIN_EMAIL`        | クライアント側管理者 UI ゲート     | Settings/Admin コンポーネント (UI のみ、セキュリティではない)     |
| `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_USER_ID` | LINE Messaging API    | `/api/notifications/send`                                         |

> `ANKI_CONNECT_URL` (サーバー env) と `API_SECRET`/`x-api-secret` は削除されました。AnkiConnect URL はユーザーごと (`settings/{uid}.anki_connect_url`、フォールバック `http://localhost:8765`); 認証はセッションクッキーに移行。

---

## 5. 📋 エンドポイント概要

| HTTP メソッド     | エンドポイント                 | 主な機能                                                                                        |
| ------------------| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| **POST、DELETE**  | `/api/auth/session`            | POST: Firebase ID token をセッションクッキーに変換; DELETE: 取り消し + クッキー削除 (ログアウト)  |
| **POST**          | `/api/auth/signup`             | ユーザー作成 (Admin SDK) + デフォルトシード + メール == ADMIN_EMAIL の場合管理者クレーム設定    |
| **GET、POST**     | `/api/admin/global-config`     | GET: `settings/global` を読み込み; POST (**管理者のみ**): フィーチャーフラグを書き込み (ai_model/tts/unsplash) |
| **POST**          | `/api/entries/save`            | Entry を Firestore に保存 (deferred `reviewed` または `synced` with note ids)                   |
| **GET、POST**     | `/api/entries/sync`            | GET: jobs (entries `reviewed` + card_types) をクライアント向けに提供; POST: 結果受け取り → `synced` に更新 |
| **POST**          | `/api/entries/check-duplicate` | 単語/用語の重複チェック                                                                         |
| **PUT**           | `/api/anki/update`             | Entry Firestore を更新 + クライアントが Anki ノートを更新するための regen payload を返す       |
| **POST**          | `/api/anki/resync`             | entries `synced` + card_types (フィルタリング後) を返す→ クライアントが note を regenerate     |
| **GET、POST**     | `/api/anki/sync-srs`           | GET: noteIds をクライアント向けに提供して Anki から SRS を読み込み; POST: cardsInfo を受け取り → review_state を更新 (precedence guard + revlog `review_events`) |
| **POST**          | `/api/generate`                | AI (Claude エージェント) がフラッシュカードコンテンツを生成                                    |
| **POST**          | `/api/audio/generate`          | TTS をレンダリング → base64 を返す (クライアントが必要に応じて Anki メディアに保存)              |
| **GET**           | `/api/image`                   | Unsplash で説明用画像を検索                                                                      |
| **GET、POST**     | `/api/history`                 | Entry 履歴のリストを取得 / 新規 Entry を追加                                                     |
| **GET、PUT、DEL** | `/api/history/[id]`            | Entry 履歴の詳細を読み込み、更新、削除                                                           |
| **CRUD**          | `/api/admin/categories`        | カード分類 Categories を管理                                                                     |
| **CRUD**          | `/api/admin/card-types`        | Card Type Config リストを管理                                                                    |
| **CRUD**          | `/api/admin/topics`            | IT Vocabulary カード用 Topics を管理                                                             |
| **CRUD**          | `/api/admin/decks`             | Anki Deck & Form type デフォルト間のマッピングを管理                                             |
| **GET、PUT**      | `/api/admin/content-types`     | Form type のメタ設定 (form fields リスト) を管理                                                 |

**削除済み (2026-07-04、`lib/flashcard-service/client-ops.ts` 経由でクライアント側に移行):** `GET /api/anki/connect` (→ クライアント `ping()`)、`GET+POST /api/anki/decks` (→ `ensureDeck`/`renameDeck`/`deleteDeckWithCleanup`/`setDeckSuspended`/`syncAllDecks`)、`POST /api/anki/create` (→ `createNotesForEntry` + `/api/entries/save`)、`POST /api/anki/ensure-model` (→ `ensureModel`)、`POST /api/audio`、`POST /api/audio/store`、`POST /api/image/store` (→ クライアント `storeMediaFile`)。

---

## 6. 📖 API 詳細 (エンドポイントリファレンス)

### 6.1 Entries & Anki-data ルート (サーバー = Firestore のみ)

> AnkiConnect コマンドはブラウザ内で実行 (`lib/flashcard-service/client-ops.ts`)。下記のルートはデータを提供/受け取るだけです。

#### `POST /api/entries/save`

Entry を Firestore に保存。2 つのフローで使用: **deferred** (Anki が閉じているときの Save — デフォルト status `reviewed`) と **synced** (クライアントが Anki でノートを作成し終えた直後)。

- **Body Params (zod-validated):**
    ```ts
    {
      "entryData": object,          // 必須 — Entry データ
      "anki_note_ids"?: number[],   // Optional — クライアントが Anki で作成したばかりの note ids
      "status"?: "draft" | "reviewed" | "synced"  // Optional — デフォルト "reviewed"
    }
    ```
- **Response (200 OK):** `{ "success": true, "entryId": "firestoreDocId123" }`
- **Response (400):** `{ "error": "Invalid request body", "issues": [...] }`

#### `GET /api/entries/sync`

`status == 'reviewed'` の entry を card_types (template 付き) と共に返す → クライアントが `buildNotes` で Anki にノートを作成。Entry は `audio_url`/`image_url` (data-URL) をそのまま保持 — クライアントが Anki メディアに `storeMediaFile` するために必要。

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

クライアントがノート作成結果を報告; サーバーは各 entry を `synced` に更新 (Promise.allSettled — 1 つの entry の失敗がバッチ全体を失敗させない)。**クライアントは必ずレスポンスをチェックする必要がある** — 見逃すと、ノートは既に Anki にあるが status が未記録 → 再同期でノートが重複作成される。

- **Body Params (zod-validated):** `{ "results": [ { "entryId": "doc123", "noteIds": [1682490000000] } ] }`
- **Response (200 OK):** `{ "synced": 3, "failed": 0 }`

#### `PUT /api/anki/update`

Firestore の Entry を更新し、クライアントが Anki でノートを再生成するためのデータを返す (best-effort — Anki がオフラインでも保存はブロックされない)。

- **Body Params:**
    ```ts
    {
      "entryId": string,   // 必須 — Firestore document ID
      "updates"?: object   // Firestore への Partial Entry 更新
    }
    ```
- **Response (200 OK):**
    ```json
    { "success": true, "entry": { "...": "..." }, "cardTypes": [], "noteIds": [123] }
    ```
- **Response (400):** `{ "error": "Missing entryId" }`
- クライアントフロー (`hooks/useEntryEdit.ts`): PUT → `regenerateNotesForEntry(client, entry, cardTypes)`。

#### `POST /api/anki/resync`

entries `synced` (フィルタリング後、レスポンスが数 MB になるのを避けるため `audio_url`/`audio_example_url` を除去) + card_types を返す → クライアントが Anki で Front/Back を regenerate。Firestore への書き込みなし。

- **Body Params:** `{ "formType"?: string, "deckName"?: string, "cardTypeId"?: string }`
- **Response (200 OK):** `{ "entries": [...], "cardTypes": [...] }`
- クライアントフロー (`components/settings/ResyncCards.tsx`): POST → `regenerateNotesForEntry(...)` をループ。

#### `GET /api/anki/sync-srs`

entries `synced` のすべての `anki_note_ids` を返す → クライアントが Anki から SRS state を照会 (`findCards('nid:a,b,...')` をチャンクごとに → `cardsInfo`)。

- **Response (200 OK):** `{ "noteIds": [123, 456] }`

#### `POST /api/anki/sync-srs`

クライアントが Anki からの cardsInfo を送信; サーバーは `ReviewState` にマップ (ANKI_QUEUE_MAP、ease/1000、due×1000、`reps` から `total_reviews`) + `review_state` を batch update (chunked ≤400 ops)。

- **Precedence guard (SRS Phase 0):** LINE 経由で既に rate 済みの entry (`review_state.source === 'builtin'`) で、rating が Anki 側のアクティビティより新しい (`last_reviewed_at` > `card.mod × 1000`; `mod` がない場合のフォールバック: > `synced_at`) → **スキップ、上書きしない** (LINE の進捗を保持)。
- **Revlog:** state が実際に変化した各 entry → `review_events` ドキュメントを 1 件 append (`kind: 'anki_sync'`、prev/next スナップショット)。
- **Body Params (zod-validated):** `{ "cards": [ { "noteId": 123, "interval": 5, "ease": 2500, "due": 1750000000, "lapses": 0, "queue": 2, "mod"?: 1751900000, "reps"?: 12 } ] }` (`mod`/`reps` は optional — 古い AnkiConnect は返さない)
- **Response (200 OK):** `{ "success": true, "synced": 10, "skipped": 1, "total": 12 }`

---

### 6.2 AI 生成

#### `POST /api/generate`

Claude (AI エージェント、tool ベース) を呼び出して、ボキャブラリーまたは IT ボキャブラリー情報を生成します。Model は tool `submit_card` を呼び出すことが強制されるため、出力は常にスキーマに準拠 (zod で検証)。Model は `settings.ai_model` から取得 (デフォルト `claude-haiku-4-5`)。マップ済みの JSON 構造を返します。

- **Body Params:**
    ```ts
    {
      "form_type": "form_language" | "form_it", // 必須 — FormType enum value
      "word"?: "string",                         // form_type = form_language の場合必須
      "language"?: "zh" | "ja" | "en",           // LanguageType enum value
      "term"?: "string",                         // form_type = form_it の場合必須
      "topics"?: ["string"]                      // topic 名の配列
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
- **Curl の例:**
    ```bash
    curl -X POST http://localhost:3000/api/generate \
         -H "Content-Type: application/json" \
         -d '{"form_type": "form_language", "language": "zh", "word": "书"}'
    ```

---

### 6.3 メディアサービス

> Anki へのメディア保存 (`storeMediaFile`) はクライアント側で `createNotesForEntry`/`storeAudioMedia`/`storeImageMedia` (`lib/flashcard-service/client-ops.ts`) で実行 — `/api/audio` (統合)、`/api/audio/store`、`/api/image/store` ルートは削除されました。

#### `POST /api/audio/generate`

TTS をレンダリング — base64 audio を返す。Audio は entry 内で data-URL 形式のまま保持 (`audio_url`); export/sync 時にクライアントが Anki メディアに保存。

- **Body Params:**
    ```ts
    {
      "text": "string",       // 必須
      "language": "zh" | "ja" | "en",  // 必須
      "filename": "string"    // 必須 — レスポンスにそのままエコー (サーバーはファイルを保存しない)
    }
    ```
- **Response (200 OK):**
    ```json
    { "success": true, "base64": "<base64-encoded-mp3>", "filename": "zh_shu_123.mp3" }
    ```

#### `GET /api/image`

キーワードに基づき Unsplash で正方形 (squarish) 画像のリストを検索して返す。

- **Query Params:**
    - `keyword`: (必須) 検索キーワード。
    - `count`: (Optional、デフォルト 5) 取得する画像数。
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

### 6.4 重複チェック

#### `POST /api/entries/check-duplicate`

単語/用語が Firestore に既に存在するかをチェック。`word`、`term`、または `title` フィールドで大文字小文字を区別しない比較を行います。

- **Body Params:**
    ```ts
    {
      "word": "string",                    // 必須 — チェックする単語
      "language"?: "zh" | "ja" | "en"      // Optional — 言語でフィルタ
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

### 6.5 履歴 (Entries Collection)

Firestore の `entries` コレクションと相互作用して学習者の記録を保存。

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

1 件の entry の詳細を取得。

#### `PUT /api/history/[id]`

- **Body Params:** `<Partial Entry update>`

#### `DELETE /api/history/[id]`

レコードを完全に削除。

---

### 6.6 Admin CRUD (Collections Manager)

アプリ内のスキーマとドロップダウンリスト設定 (Category、Topic、Deck Configs) を管理するために使用される API グループ。ほとんどが標準的な RESTful CRUD アーキテクチャに従います。

#### グループ `/api/admin/categories` & `/api/admin/topics` & `/api/admin/card-types` & `/api/admin/decks`

- **GET:** 対応する document の array を返す。filter params を受け取り可能 (例: `?form_type=form_language`)。常に `sort_order` または `name` フィールドでソート。
- **POST:**
    - Body payload は新しい document 全体。
    - _システム動作:_ `created_at`、`updated_at` を自動付与。デフォルト `is_active = true`。
- **PUT:**
    - Body payload: `{ "id": "docId", "name": "New Name", ... }`
- **DELETE:**
    - **実行:** 2 パターンあります。
        1. `categories` の場合: hard-delete ではなく、`?id=xyz&is_active=false` クエリを受け取って Soft-Delete (状態トグル) を実行。
        2. その他のテーブルの場合: `?id=xyz` を呼び出して Hard-Delete。

#### グループ `/api/admin/content-types`

動的フォーム構造を管理 (UI がどの入力リストをレンダリングするか)。

- **GET**: config を含む document を返す。
- **PUT**: `fields` 配列を更新。
