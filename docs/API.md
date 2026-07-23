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
        GenAPI[/api/generate, /api/content-types/suggest-instruction]
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
    - `403 Forbidden`: 認証済みでも権限がない、または機能がサーバー設定で無効。
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
| `/api/auth/*` | Public | session (ログイン)、サインアップ、ログアウト — サインアップは `SIGNUP_ENABLED=true` の場合のみ実行 |
| `/api/notifications/line-webhook` | Public (LINE 署名) | LINE プラットフォームが外部から呼び出し |
| `/api/notifications/line-link`、`/api/notifications/send` | **`withAuth` 相当** (セッションクッキー) → 不足/不正時 401 | 呼び出し元 UID の LINE 連携・テスト通知のみ操作 |
| `/api/entries/*`、`/api/anki/*`、`/api/history/*`、`/api/generate`、`/api/content-types/suggest-instruction`、`/api/languages/detect`、`/api/audio/generate`、`/api/image` | **`withAuth`** (セッションクッキー) → 不足/不正時 401 | UID に基づいてデータをスコープ |
| `/api/admin/global-config` (POST)、`/api/admin/content-types` (PUT/DELETE) | セッションクッキー **+ `email === ADMIN_EMAIL`** → 管理者でない場合 403 | コントロールプレーン mutation |
| `/api/admin/content-types` (GET) | `withAuth` | 新規ユーザー用 global Content Type defaults を取得 |
| その他の `/api/admin/*` (CRUD レガシー) | `withAuth` | クライアントコーラーなし (UI は Client SDK を使用) |
| `/api/integrations/*` | ヘッダー `x-integration-token` **+ `INTEGRATION_TOKEN`** (constant-time 比較) → 401 | セッションクッキーなし、外部システム専用 |
| `/api/cron/*` | ヘッダー `Authorization: Bearer` **+ `CRON_SECRET`** (constant-time 比較) → 401 | GitHub Actions の定期実行専用 |

**データの分離:** すべての `entries` + マスターデータクエリが `user_id == uid` でフィルタリング; ミューテーション時の所有権チェック (別のユーザーのエントリを更新/削除 → 404)。最後のレイヤーは **Firestore Security Rules** (Client SDK)。

**管理者 (2 つの独立したメカニズム):** サーバーは env `ADMIN_EMAIL` を使用; Firestore ルールはカスタムクレーム
`admin:true` を使用。`NEXT_PUBLIC_ADMIN_EMAIL` は UI ゲートのみ。

**公開サインアップ:** `SIGNUP_ENABLED` は server-only の fail-closed gate。明示的な `true` の場合のみ
`/signup` と `POST /api/auth/signup` が有効になり、未設定・`false`・不正値の場合 API は Firebase を
呼び出す前に `403 { "error": "Sign-ups are currently closed" }` を返す。既存ユーザーのログインには影響しない。

---

## 4. ⚙️ 環境変数

API が機能するために必要な環境変数のマッピング表 (`.env` で設定):

| 環境変数                         | 対応するサービス                   | 使用されるルート                                                   |
| -------------------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`              | Anthropic Claude API               | `/api/generate`、`/api/content-types/suggest-instruction`         |
| `GOOGLE_TTS_CREDENTIALS_JSON`    | Google Cloud Service Account JSON の中身 (serverless 用、優先) | `/api/audio/generate`                              |
| `GOOGLE_APPLICATION_CREDENTIALS` | Google Cloud Service Account key file のパス (ローカル用の代替) | `/api/audio/generate`                             |
| `UNSPLASH_ACCESS_KEY`            | Unsplash Developer API             | `/api/image`                                                      |
| `FIREBASE_ADMIN_PROJECT_ID`      | Firebase Admin SDK (Auth + Firestore) | `withAuth` を持つすべてのルート + `/api/auth/*`                 |
| `FIREBASE_ADMIN_CLIENT_EMAIL`    | Firebase Admin SDK                 | (上に同じ)                                                        |
| `FIREBASE_ADMIN_PRIVATE_KEY`     | Firebase Admin SDK                 | (上に同じ)                                                        |
| `ADMIN_EMAIL`                    | サーバー側管理者判定               | `/api/admin/global-config`、`/api/admin/content-types` mutation、サインアップ (クレーム設定) |
| `NEXT_PUBLIC_ADMIN_EMAIL`        | クライアント側管理者 UI ゲート     | Settings/Admin コンポーネント (UI のみ、セキュリティではない)     |
| `SIGNUP_ENABLED`                 | 公開アカウント作成 gate (既定: 無効) | `/signup`、`/login` の signup link、`POST /api/auth/signup`      |
| `LINE_CHANNEL_ACCESS_TOKEN`      | LINE Messaging API push/reply      | `/api/notifications/send`、`/api/notifications/line-webhook`、`/api/cron/srs-push` |
| `LINE_CHANNEL_SECRET`            | LINE webhook 署名検証               | `/api/notifications/line-webhook`                                  |
| `NEXT_PUBLIC_LINE_ADD_FRIEND_URL` | LINE 公式アカウント追加 URL (公開値) | Settings の LINE 連携 UI                                          |
| `INTEGRATION_TOKEN`              | 外部システム認証トークン           | `/api/integrations/term-drafts`                                   |
| `INTEGRATION_TARGET_UID`         | term draft の作成先固定 uid        | `/api/integrations/term-drafts`                                   |
| `CRON_SECRET`                    | GitHub Actions → cron API の共有 secret | `/api/cron/srs-push`                                          |

> 現行アプリ/cron では `LINE_USER_ID` と `SRS_PUSH_TARGET_UID` を使用せず、通知先を各 `settings/{uid}.line_user_id` から解決します。`LINE_USER_ID` を参照する legacy 手動 script/workflow はクロスユーザー分離を満たさないため実行しないでください。`ANKI_CONNECT_URL` (サーバー env) と `API_SECRET`/`x-api-secret` も削除済みです。AnkiConnect URL はユーザーごと (`settings/{uid}.anki_connect_url`、フォールバック `http://localhost:8765`); 認証はセッションクッキーに移行。

---

## 5. 📋 エンドポイント概要

| HTTP メソッド     | エンドポイント                 | 主な機能                                                                                        |
| ------------------| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| **POST、DELETE**  | `/api/auth/session`            | POST: Firebase ID token をセッションクッキーに変換; DELETE: 取り消し + クッキー削除 (ログアウト)  |
| **POST**          | `/api/auth/signup`             | `SIGNUP_ENABLED=true` の場合のみユーザー作成 + デフォルトシード + admin claim。無効時は 403    |
| **GET、POST**     | `/api/admin/global-config`     | GET: `settings/global` を読み込み; POST (**管理者のみ**): AI/media/LINE のグローバル設定を書き込み |
| **POST、DELETE**  | `/api/notifications/line-link` | 認証 user の一時連携コードを発行 / LINE 連携を解除                                  |
| **POST**          | `/api/notifications/send`      | 認証 user の連携先へ期限の来た entry をテスト送信 (1 分 cooldown)                   |
| **POST**          | `/api/notifications/line-webhook` | LINE 署名を検証し、連携コード・follow・復習 rating postback を処理                |
| **POST**          | `/api/entries/save`            | Entry を Firestore に保存 (deferred `reviewed` または `synced` with note ids)                   |
| **GET、POST**     | `/api/entries/sync`            | GET: jobs (entries `reviewed` + card_types) をクライアント向けに提供; POST: 結果受け取り → `synced` に更新 |
| **POST**          | `/api/entries/check-duplicate` | 単語/用語の重複チェック                                                                         |
| **PUT**           | `/api/anki/update`             | Entry Firestore を更新 + クライアントが Anki ノートを更新するための regen payload を返す       |
| **POST**          | `/api/anki/resync`             | entries `synced` + card_types (フィルタリング後) を返す→ クライアントが note を regenerate     |
| **GET、POST**     | `/api/anki/sync-srs`           | GET: noteIds をクライアント向けに提供して Anki から SRS を読み込み; POST: cardsInfo を受け取り → review_state を更新 (precedence guard + revlog `review_events`) |
| **POST**          | `/api/generate`                | AI (Claude エージェント) がフラッシュカードコンテンツを生成                                    |
| **POST**          | `/api/content-types/suggest-instruction` | Content Type の出力要件から編集可能な English instruction 候補を生成                 |
| **POST**          | `/api/languages/detect`        | 入力語の言語を BCP 47 形式で構造化判定                                                         |
| **POST**          | `/api/audio/generate`          | TTS をレンダリング → base64 を返す (クライアントが必要に応じて Anki メディアに保存)              |
| **GET**           | `/api/image`                   | Unsplash で説明用画像を検索                                                                      |
| **GET、POST**     | `/api/history`                 | Entry 履歴のリストを取得 / 新規 Entry を追加                                                     |
| **GET、PUT、DEL** | `/api/history/[id]`            | Entry 履歴の詳細を読み込み、更新、削除                                                           |
| **POST**          | `/api/history/bulk-delete`     | 所有する Entry を最大 100 件削除し、未処理の Anki note ID を user settings queue に保存          |
| **CRUD**          | `/api/admin/categories`        | カード分類 Categories を管理                                                                     |
| **CRUD**          | `/api/admin/card-types`        | Card Type Config リストを管理                                                                    |
| **CRUD**          | `/api/admin/topics`            | IT Vocabulary カード用 Topics を管理                                                             |
| **CRUD**          | `/api/admin/decks`             | Anki Deck & Form type デフォルト間のマッピングを管理                                             |
| **GET、PUT、DELETE** | `/api/admin/content-types`  | 新規ユーザー用 Content Type defaults を取得・更新。Mutation は管理者のみ、built-in delete 禁止    |
| **POST**          | `/api/integrations/term-drafts` | 外部システム (Knowledge Hub) から term draft を受け取り Entry (`status:'draft'`) を作成          |
| **GET**           | `/api/cron/srs-push`           | GitHub Actions 用 — user ごとの timezone に従って LINE 通知を fan-out                       |

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

`status == 'reviewed'` の entry を card_types (template 付き) と共に返す → クライアントが `buildNotes` で Anki にノートを作成。Entry は `audio_url` / `audio_example_url` / `image_url` (data-URL) をそのまま保持 — クライアントが Anki メディアに `storeMediaFile` するために必要。

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

Claude (AI エージェント、tool ベース) を呼び出して、built-in または custom Content Type のカード情報を生成します。Model は tool `submit_card` を呼び出すことが強制され、output profile から構築した Zod schema で検証されます。Model は `settings/global.ai_model` から取得 (デフォルト `claude-haiku-4-5`)。Create は選択中の workspace snapshot ID を `content_type_id` として送り、server が `user_content_types/{id}` の owner・routing code・`ai_output_profiles` を検証してから data-driven prompt engine を使用します。ID がない旧 request、または profile 未設定 document も built-in/generic profile を materialize し、同じ engine を使用します。

- **Body Params:**
    ```ts
    {
      "form_type": "string",                      // 必須 — built-in は FormType enum、custom は Content Type code
      "word"?: "string",                         // form_type = form_language の場合必須
      "language"?: "string",                        // form_language では必須 — 有効な BCP 47 code (例 fr、pt-BR)
      "language_name"?: "string",                   // Optional — ユーザー設定の表示名
      "output_language"?: "string",                 // Optional — AI 出力言語 (BCP 47)。無効/未指定 → 'vi' に fallback
      "output_language_name"?: "string",            // Optional — 出力言語の表示名。未指定ならサーバーが code から推論
      "term"?: "string",                         // form_type = form_it の場合必須
      "topics"?: ["string"],                     // topic 名の配列
      "dynamicFields"?: { "field_key": "value" }, // fields[] 由来の追加 context。custom では生成 schema にも反映
      "contentTypeName"?: "string",              // ID がない旧 custom request の表示名 hint
      "content_type_id"?: "string",              // 選択した user_content_types document ID
      "content_type_inline"?: {                    // Editor の未保存 draft を Test 実行する場合のみ
        "code": "string",
        "name": "string",
        "description"?: "string (≤500)",
        "fields": "FormFieldConfig[] (1〜40)",
        "ai_output_profiles"?: "AiOutputProfile[]"
      }
    }
    ```
- **保存済み Content Type:** `content_type_inline` がなく `content_type_id` がある場合、server は document が同じ UID に属し、保存済み `code` が `form_type` と同じ runtime route に解決されることを確認します。不一致/不正設定は 400、他 user または存在しない ID は 404。通常の Create flow では client が instruction/schema を上書きできません。
- **Inline editor test:** `content_type_inline` は `content_type_id` より優先され、Content Type editor の未保存 `fields` / `ai_output_profiles` で試験生成するために使用します。認証は通常の generate と同じ Firebase session が必須。Payload は code/name/description/field/profile の件数・文字数・key/type を Zod で制限し、解決した routing code が `form_type` と一致しない場合は 400。Inline definition は Firestore に保存されず、この明示的な Test 経路に限り user-authored instruction/schema を provider へ渡します。
- **Custom Content Type:** `word` に primary field の値、`form_type` に user Content Type の `code`、`dynamicFields` にフォーム context を送信します。保存済み profile がある document は宣言された field/schema を使用します。Profile 未設定 document は primary と安全な form field から generic profile を materialize します。ID がない旧 custom request も reserved metadata key を除外した `dynamicFields` から同じ generic engine profile を構築します。
- **Output profile selection:** Study language の primary BCP 47 subtag (`en` / `zh` / `ja` など) と同名の profile を優先し、なければ `default` を使用します。選ばれた言語 profile は `default` を **継承** し、実効 field は `[...lang.fields, ...default.fields.filter(継承対象)]` になります (詳細は `docs/DATABASE.md` の継承モデル)。`inherit` / `exclude` を持たない legacy profile は読み取り時に正規化され、移行前と同じ field 集合を保ちます。`include_when: 'output_vi'` の field は output language が Vietnamese の場合だけ含めます。General Knowledge は従来どおり local strategy で、この API を呼びません。
- **`content_type_inline.ai_output_profiles`:** `AiOutputProfile[]` は `inherit?: true` と `exclude?: string[]` を含みます。Editor の Test 実行は runtime と同じ schema を検証するため、この 2 つを落とさずに送る必要があります (client は `cloneAiOutputProfiles` を使用)。
- **配列 field の件数 (`max_items`):** `string_array` field の `max_items` は生成結果の配列上限を制限すると同時に、field instruction 内のテンプレートトークン `{max_items}` に解決されます。管理者が Content Type editor の「Maximum items」を変更すると、schema の上限と prompt の文言 (例: 「Up to N of the most important ...」) の両方に反映され、AI は重要な順に最大 N 件を返します。built-in の `collocations` は 5、`related_words` は 10。instruction で使えるトークンは `{output_language}` / `{study_language}` / `{max_items}`。
- **言語 validation:** `form_type = form_language` で `language` がない、または無効な BCP 47 code の場合は 400。code は provider 呼び出し前に canonicalize (`pt_br` → `pt-BR`)。
- **AI 出力言語 (2026-07-15 以降):** カードの意味・訳・品詞ラベルなどのコンテンツ言語は `output_language` で決まる (ユーザー設定 `settings/{uid}.ai_output_language` からクライアントが送信)。canonicalize に失敗または未指定の場合は `'vi'` に fallback — 旧クライアントとの後方互換を維持。`output_language ≠ 'vi'` の場合、中国語/日本語 schema から `han_viet` (ハンベトナム音 — ベトナム語話者専用の概念) が除外される。フィールド名 (`meaning_vi` など) は Anki テンプレート互換のため legacy 名のまま変わらない。生成された Entry には `output_language` メタデータが保存される (`docs/DATABASE.md` 参照)。
- **Normalization / trust boundary:** Model が返した primary field (`word` / `term` / custom primary) は request の入力値で上書きします。`word_type` がない場合は `word_type_vi`、`definition` がない場合は `definition_vi` を alias として補完します。Preview では form type、language、deck、category、card types、topics、tags などの application/session metadata を AI content より後に merge します。
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
         -d '{"form_type": "form_language", "content_type_id": "form_language__USER_UID", "language": "zh", "word": "书"}'
    ```

#### `POST /api/content-types/suggest-instruction`

Content Type editor で、field の自然言語要件から AI output instruction の候補を 1 件生成します。通常の Firebase session が必須で、`settings/global.ai_model` と共通 AI provider factory を使用します。Claude は `submit_instruction_suggestion` tool の呼び出しを強制され、English かつ 300 文字以内の schema で検証されます。候補には「何を返すか」「形式または制約」「値を生成できない場合の empty value」を含め、必要な場合のみ `{output_language}` / `{study_language}` placeholder を使用します。

- **Body Params (zod-validated):**
    ```ts
    {
      "field_key": "meaning",             // lowercase snake_case、1〜40 文字、予約 metadata key は不可
      "type": "string" | "string_array",
      "description": "Desired output"     // 1〜300 文字
    }
    ```
- **Response (200 OK):**
    ```json
    {
      "instruction": "Return a concise definition in {output_language}. Return an empty string if the meaning is unknown."
    }
    ```
- この route は Content Type または profile を保存しません。Client は返された候補を現在の draft textarea に反映し、ユーザーが編集・確認してから通常の保存操作を行います。
- **Response (400):** JSON/body/key/type/description が不正。**Response (401):** session がない、または不正。**Response (500):** AI 設定または provider が失敗。

#### `POST /api/languages/detect`

最大 100 件の入力語を Claude の強制 tool call で判定し、各 item に対応する canonical BCP 47 code を返す。Create flow は結果を現在のユーザーの `settings/{uid}.study_languages` と照合し、未登録または無効な言語の場合に追加確認を表示する。

- **Body Params (zod-validated):**
    ```ts
    {
      "items": ["olá", "obrigado"],        // 1〜100 件、各 1〜200 文字
      "candidate_languages": [
        { "code": "pt-BR", "display_name": "Português" }
      ]                                      // ユーザー設定の候補、最大 100 件
    }
    ```
- **Response (200 OK):**
    ```json
    {
      "detections": [
        { "index": 0, "code": "pt-BR", "display_name": "Português", "confidence": 0.96 },
        { "index": 1, "code": "pt-BR", "display_name": "Português", "confidence": 0.95 }
      ]
    }
    ```
- **Response (400):** item 数・文字数・candidate code が不正。**Response (401):** session がない。**Response (500):** provider が失敗。

---

### 6.3 メディアサービス

> Anki へのメディア保存 (`storeMediaFile`) はクライアント側で `createNotesForEntry` /
> `storeAudioMedia` / `storeAudioExampleMedia` / `storeImageMedia`
> (`lib/flashcard-service/client-ops.ts`) で実行 — `/api/audio` (統合)、
> `/api/audio/store`、`/api/image/store` ルートは削除されました。

#### `POST /api/audio/generate`

TTS をレンダリング — base64 audio を返す。単語音声は `audio_url`、例文音声は
`audio_example_url` として entry 内に data-URL 形式で保持し、export/sync 時にクライアントが
Anki メディアに保存します。例文 TTS の自動生成はクライアント側で、非空の
`example_sentence` があり、TTS が有効で、選択中 Card Type template の少なくとも 1 つが
`audio_example` block を使う場合だけ実行します。この gate は API contract ではなく、
共有 TTS コストを不要に消費しないための Preview/History client policy です。

- **Body Params:**
    ```ts
    {
      "text": "string",       // 必須
      "language": "string",   // 必須 — 有効な BCP 47 code (例 zh、fr、pt-BR)
      "filename": "string"    // 必須 — レスポンスにそのままエコー (サーバーはファイルを保存しない)
    }
    ```
- **Response (200 OK):**
    ```json
    { "success": true, "base64": "<base64-encoded-mp3>", "filename": "zh_shu_123.mp3" }
    ```
- **Voice 解決:** base code `en`/`zh`/`ja` は既存の専用 Wavenet voice を維持。中国語系バリアントは Google TTS が対応する locale に写像する (`zh-TW` → `cmn-TW`、`zh-HK` → `yue-HK`、その他の `zh-*` → `cmn-CN`)。それ以外は BCP 47 locale を canonicalize し、region がない場合は `Intl.Locale.maximize()` で補完して Google TTS に voice 自動選択を任せる。英語への暗黙 fallback は行わない。
- **Response (400):** 必須 field または BCP 47 code が不正。**Response (403):** `settings/global.tts_available == false`。

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
      "language"?: "string"                  // Optional — BCP 47 code でフィルタ
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

#### `POST /api/history/bulk-delete`

History UI の単一・一括削除で使用。対象 Entry を所有権確認後に同一 Firestore batch で削除し、
ブラウザ側で AnkiConnect cleanup が完了しなかった場合は note ID を `settings/{uid}` の retry queue に保存する。
他ユーザー所有または存在しない ID は存在を漏らさず `skipped` として扱う。

- **Body Params:**
    ```json
    {
      "ids": ["entry-1", "entry-2"],
      "anki_cleaned": false
    }
    ```
  - `ids`: 1〜100 件の Entry document ID。
  - `anki_cleaned`: ブラウザが対象 Anki notes を削除済み、または対象 note がない場合 `true`。
- **Response (200 OK):**
    ```json
    { "deleted": 2, "skipped": 0, "queued_note_count": 4 }
    ```
- **Response (400):** `{ "error": "Invalid request body" }`
- Queue は `FieldValue.arrayUnion` で merge され、Sidebar の次回 Sync が client-side AnkiConnect で
  idempotent に削除した後、`arrayRemove` で処理済み ID だけを取り除く。サーバーは AnkiConnect を呼び出さない。

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

新規アカウントへ snapshot としてコピーする global Content Type defaults を管理します。Runtime の
Create / Resync はこの API または `content_types` を fallback として使用せず、ユーザー別
`user_content_types` を読みます。

- **GET**: Firebase セッション必須。global config document を返す (管理者以外のログイン済み user も取得可)。
- **PUT**: Firebase セッション + server-only `ADMIN_EMAIL` 一致が必須。Body は
  `{ "id": string, "fields": FormFieldConfig[] }`。対象 document を読み、保存済みの実 `code` / `name` で完全な field schema、重複 key、built-in invariant
  (Language: `language` + `word`、IT: `term`、General: `title`) を検証してから更新。違反は 400。
- **DELETE**: Firebase セッション + `ADMIN_EMAIL` 一致が必須。Query `?id=<documentId>`。
  Custom global default は削除可能ですが、`form_language` / `form_it` / `form_general` は 403。
- **認証エラー**: session 不足・不正は 401、認証済み non-admin mutation または `ADMIN_EMAIL` 未設定は 403。

### 6.7 LINE Notifications

#### `POST /api/notifications/line-link`

認証済み user 専用の一時コードを生成し、LINE webhook 経由で `settings/{uid}.line_user_id` と結び付ける。

- **認証:** Firebase セッションクッキー。`settings/global.line_notifications_available == false` の場合は 403。
- **コード:** `ANKI-` + 6 文字 (`A-HJ-NP-Z2-9`、約 30 bit)。有効期限は 10 分。user の旧コードを置き換える。
- **衝突処理:** Firestore `create` で既存コードを上書きせず、衝突時は最大 3 回再生成する。
- **Response (200 OK):** `{ "code": "ANKI-ABCDEF", "expires_at": "..." }`。
- **エラー:** 未認証 → 401、グローバル無効 → 403、発行失敗 → 500。

#### `DELETE /api/notifications/line-link`

認証 user の `line_user_id` を削除し、`line_notifications_enabled` を `false` にして連携を解除する。

- **Response (200 OK):** `{ "success": true }`。
- **エラー:** 未認証 → 401、更新失敗 → 500。

#### `POST /api/notifications/send`

認証 user 自身の期限到来 entry を LINE Flex Message で即時テスト送信する。管理者専用 API ではない。

- **認証・分離:** Firebase セッションクッキーから UID を取得し、`entries.user_id == uid` のみ query。
- **Body (任意):** `{ "deck_filter": string[], "language_filter": string[], "count": 1..10 }`。`count` 未指定時は `settings/global.line_words_per_notification`、既定値 5。
- **コスト保護:** `settings/{uid}.line_last_test_at` を transaction で claim し、user ごとに 60 秒の cooldown を適用。同時リクエストも 1 件だけ通す。
- **Response:** 成功 → `{ "success": true, "sent": number, "words"?: string[] }`。期限到来なしは `sent: 0`。
- **エラー:** 未認証 → 401、未連携 → 400、グローバル無効 → 403、cooldown 中 → 429 (`Retry-After` header + `retry_after_seconds`)、LINE 設定なし → 500、push 失敗 → 502。

#### `POST /api/notifications/line-webhook`

LINE からのイベントを `x-line-signature` と `LINE_CHANNEL_SECRET` で検証して処理する。

- **message:** 有効な未使用コードを受け取ると `settings/{uid}.line_user_id` を保存し、コードを削除。
- **follow:** 連携手順を返信。
- **postback:** `settings/{entry.user_id}.line_user_id` と送信元 LINE user が一致する場合のみ rating を適用し、`review_events` に追記。
- **エラー:** channel secret 未設定 → 500、署名不正 → 401。

### 6.8 Integrations & Cron（セッションクッキーなし）

`middleware.ts` の exclude matcher 対象 — セッションクッキーを持たない外部呼び出し専用。
それぞれ独自のトークン比較 (`crypto.timingSafeEqual`、`lib/auth-guard.ts` の `verifyStaticToken`) で保護。

#### `POST /api/integrations/term-drafts`

外部システム (Knowledge Hub) から term draft を受け取り、固定 1 ユーザー (`INTEGRATION_TARGET_UID`) 用に
`status:'draft'` の Entry を作成。**`/api/generate` は呼ばない** — ユーザーが UI で確認して Generate する。

- **認証:** ヘッダー `x-integration-token` == env `INTEGRATION_TOKEN`。
- **Body Params (zod-validated):**
    ```ts
    {
      "source": "knowledge-hub",
      "items": [
        {
          "term": "string",
          "language": "string",  // 有効な BCP 47 code。保存前に canonicalize
          "definition_hint_vi"?: "string",
          "context_quote"?: "string (≤200 文字)",
          "source_url": "string",
          "source_title": "string"
        }
      ] // 1〜20 件
    }
    ```
- **重複チェック:** `entries` を `user_id == INTEGRATION_TARGET_UID` でスキャンし、`term`/`word`/`title` を
  正規化 (`normalizeTerm` — lowercase + trim) して比較。同一リクエスト内の重複も検出。
- **Entry デフォルト値:** `category_id: null`、`tags: []`、`anki_deck`/`card_type_ids` は対象ユーザーの
  `form_type:'form_it'` デッキ設定から取得 (未設定なら `Vocabulary::IT` / `[]` にフォールバック)。
- **Response (200 OK):** `{ "created": ["entryId1", ...], "skipped": [{ "term": "...", "reason": "duplicate" }] }`
- **エラー:** トークン不正 → 401。body 不正/件数超過 → 400 (このリポジトリの他ルートと同じ規約)。

#### `GET /api/cron/srs-push`

`.github/workflows/srs-push.yml` が毎時 3 回 (7・27・47 分 — GitHub Actions は 0 分の混雑で
run が遅延・欠落しやすいため 0 分を避ける) 呼び出し、通知を有効にした user へ期限の来た
SRS entry を LINE Flex Message で fan-out する。`vercel.json` からは cron 設定を削除済み。

- **認証:** ヘッダー `Authorization: Bearer <CRON_SECRET>`。GitHub Actions secrets に `APP_URL` と `CRON_SECRET` を設定する。
- **グローバル gate:** `settings/global.line_notifications_available` が false、または `line_schedule_hours` が空なら送信しない。
- **対象:** `settings.where('line_notifications_enabled', '==', true)`。各 doc ID を UID とし、`line_user_id` がある user のみ処理。
- **時刻・idempotency:** `resolvePushKey` (`lib/notifications/schedule.ts`) が判定。`line_timezone` (不正/未設定は UTC) の現在の時が `line_schedule_hours` に含まれれば現在時の key で送信。現在の時が対象外でも、**直前の時**が配信時刻で未 push なら直前時の key で catch-up 送信する (cron run の欠落・遅延対策 — 通知は最大 ~1 時間遅れで届く)。同一 user・同一ローカル日時/時は `line_last_push_key` で再送を抑止し (現在時の key で push 済みなら catch-up も行わない)、push 成功後だけ key を更新する。
- **クエリ:** user ごとに `entries.user_id == uid` かつ `status in ['synced','reviewed']` で取得し、`pickDueForReview` で優先度付け。件数は `line_words_per_notification` (1〜10、既定 5)。最大 5 user を並列処理。
- **Response (200 OK):** `{ "pushed": number, "skipped": number, "failed": number }`。グローバル無効/未設定時は `{ "pushed": 0, "reason": "disabled" | "no schedule" }`。
- **エラー:** トークン不正 → 401、LINE access token 未設定 → 500。user 単位の失敗は `failed` に集計し、他 user の処理を継続する。
