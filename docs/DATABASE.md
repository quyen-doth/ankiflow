# データベース構造 — AnkiFlow

> **データベース:** Google Firestore (NoSQL、ドキュメントベース)
> **バージョン:** v2.0 (マルチユーザー — Firebase Auth)
> **注記:** 関係は論理的参照 — SQL のようなハードな外部キーではありません。

## マルチユーザーモデル (v2.0)

- **ユーザーごとのコレクション** (`entries`、`categories`、`card_types`、`topics`、`decks`、`notification_triggers`): 各ドキュメントは **`user_id`** フィールド = Firebase Auth UID を持っています。すべてのクエリ (クライアント + サーバー) は `where('user_id', '==', uid)` でフィルタ。Firestore Security Rules (`firestore.rules`) は DB レイヤーでのクロスアクセスをブロック。
- **`content_types` SHARED**: `user_id` がない — すべてのユーザーで共有されます。そのドキュメント ID (`form_language`/`form_it`/`form_general`) がまさに `form_type` の値 (コアルーティングフィールド) であるため。管理者のみが編集可能。
- **マスターデータ ID スキーム**: 新しいユーザーに seed を行うとき、ID = `{defaultId}__{uid}` (例 `cat_daily__abc123`) — デッキ内の FK は同じ規則による文字列連結で再マップ。`lib/seed-defaults.ts` を参照。
- **テンプレート `__defaults__`**: `user_id == '__defaults__'` のマスターデータドキュメントは、管理者が `/admin` ("新規ユーザーのデフォルト") 経由で編集するテンプレート; `seedUserDefaults` は新しいユーザーのためにそれらをクローン。実際の UID ではありません。

---

## コレクション概要

| Collection | 説明 | Scope |
|---|---|---|
| `entries` | 作成された語彙 | ユーザーごと |
| `categories` | コンテンツ分類 | ユーザーごと (+ テンプレート) |
| `card_types` | Anki フラッシュカードの種類 | ユーザーごと (+ テンプレート) |
| `topics` | IT トピック | ユーザーごと (+ テンプレート) |
| `decks` | Anki Deck config + Form マッピング | ユーザーごと (+ テンプレート) |
| `notification_triggers` | LINE リマインダースケジュール (管理者) | ユーザーごと |
| `review_events` | SRS Revlog — `review_state` へのすべての変更履歴 (append-only) | ユーザーごと — **サーバーのみ書き込み** |
| `content_types` | 入力フォーム設定 (doc id = form_type) | **SHARED** — 管理者のみ書き込み |
| `settings` | 3 種類の doc: `{uid}` prefs + 学習言語 · `global` flags · `default` secrets | Settings セクション参照 |

---

## コレクション詳細

### `entries` — 作成された語彙

システムの主要ドキュメント。すべての言語と form type の語彙情報を保存。

| Field | Type | 説明 |
|---|---|---|
| `id` | string (PK) | Document ID |
| `user_id` | string | Firebase Auth UID — entry の所有者 (すべてのクエリで filter 必須) |
| `category_id` | string (FK) | `categories` への参照 (nullable) |
| `form_type` | string | 使用された form の種類: `form_language` / `form_it` / `form_general` |
| `language` | string | canonical BCP 47 言語 code (例 `en`、`fr`、`pt-BR`; nullable、主に form_type = form_language) |
| `word` | string | 語彙 (Language form) |
| `term` | string | 用語 (IT form) |
| `title` | string | タイトル (General form) |
| `meaning_vi` | string | ベトナム語の意味 |
| `definition` | string | 定義 (IT form) |
| `content` | string | 詳細なコンテンツ (General form) |
| `note` | string | 個人メモ |
| `word_type` | string | 名詞 / 動詞 / 形容詞... |
| `pinyin` | string | ピンイン (中国語) |
| `han_viet` | string | ハンベトナム音 (中国語) |
| `hiragana` | string | ひらがな (日本語) |
| `katakana` | string | カタカナ (日本語) |
| `romaji` | string | ローマ字 (日本語) |
| `ipa` | string | IPA 発音記号 (汎用言語 profile を含む) |
| `level` | string | レベル: A1/A2/B1... または N5/N4... |
| `example_sentence` | string | 例文 |
| `example_translation` | string | 例文の翻訳 |
| `collocations` | string[] | 付随するフレーズ |
| `image_url` | string | イラスト画像 URL |
| `image_credit` | string | 画像のソース (Unsplash...) |
| `audio_url` | string | 単語の音声ファイル URL/名前 |
| `audio_example_url` | string | 例文の音声ファイル URL/名前 |
| `anki_deck` | string | エクスポート先の Anki デック名 |
| `anki_note_ids` | number[] | Anki 内のノート ID |
| `card_type_ids` | string[] | 選択された `card_types` への参照 |
| `tags` | string[] | Anki のタグ (AI 生成 + ユーザーカスタム) |
| `keywords` | string[] | IT キーワード (IT vocab 固有) |
| `topic_ids` | string[] | `topics` への参照 |
| `difficulty` | string | 難易度: `easy` / `medium` / `hard` (IT vocab 固有) |
| `review_state` | object | 現在の SRS 状態 (ease/interval/due_date/queue/`source`/`fsrs`...) — nullable。FSRS (`lib/srs/fsrs.ts`、旧 SM-2 は `sm2.ts.bak` に退避) を使用；`fsrs` block (stability/difficulty/state/reps/scheduled_days/last_review) が正データ、旧フィールドは後方互換の mirror。2 つの writer: Anki sync (`source:'anki_sync'`) と LINE rating (`source:'builtin'`)、**precedence guard** あり (`review_events` 参照) |
| `integration_source` | string | 外部システム連携元 (例 `'knowledge-hub'`) — `/api/integrations/term-drafts` 経由の entry のみ、nullable |
| `source_url` / `source_title` | string | 連携元の参照 URL / タイトル — 同上、nullable |
| `context_quote` | string | 連携元の引用テキスト (≤200 文字) — 同上、nullable |
| `output_language` | string | AI が生成したコンテンツ (meaning_vi/example_translation...) の言語 — canonical BCP 47。未設定 = legacy `vi`。フィールド名 `_vi` は Anki テンプレート互換のため legacy 名のまま |
| `created_at` | timestamp | 作成日時 |
| `updated_at` | timestamp | 更新日時 |
| `status` | string | ステータス: 下の enum 参照 |

---

**Enum: `status`**

| Value | 意味 | Transition |
|---|---|---|
| `draft` | 作成中、未完成 | → `reviewed` |
| `reviewed` | AI がエンリッチ済み、エクスポート準備完了 | → `synced` / `draft` |
| `synced` | Anki へのエクスポート成功 | — |

---

### `categories` — コンテンツ分類

カテゴリごとに entries をグループ化 (例: 動詞、名詞、慣用句...)。

| Field | Type | 説明 |
|---|---|---|
| `id` | string (PK) | Document ID (seed 時 `{defaultId}__{uid}`) |
| `user_id` | string | Firebase Auth UID (またはテンプレート版は `__defaults__`) |
| `name` | string | カテゴリ名 |
| `form_type` | string | どの form type に属するか |
| `sort_order` | number | 表示順序 (in-memory ソート — composite index を回避するため orderBy 不使用) |
| `is_active` | boolean | アクティブかどうか |
| `created_at` | timestamp | — |
| `updated_at` | timestamp | — |

---

### `card_types` — フラッシュカードの種類

Anki カードの種類を定義 (例: Word→Meaning、Meaning→Word、Cloze...)。

| Field | Type | 説明 |
|---|---|---|
| `id` | string (PK) | Document ID (seed 時 `{defaultId}__{uid}`) |
| `user_id` | string | Firebase Auth UID (または `__defaults__`) |
| `code` | string | 識別コード (**ユーザーごとに** unique — C4b backlog: 未強制) |
| `name` | string | 表示名 |
| `description` | string | 説明 |
| `form_type` | string | どの form type に属するか |
| `language` | string | 適用する canonical BCP 47 code (nullable = 全言語) |
| `is_default` | boolean | デフォルトで選択されるか |
| `is_active` | boolean | — |
| `sort_order` | number | 表示順序 |
| `template` | object | `{ front: string[], back: string[] }` — Front/Back のレンダリングレイアウトブロック |
| `created_at` | timestamp | — |

---

### `topics` — IT トピック

IT ボキャブラリー専用。Entries は複数のトピックに属することができます。

| Field | Type | 説明 |
|---|---|---|
| `id` | string (PK) | Document ID (seed 時 `{defaultId}__{uid}`) |
| `user_id` | string | Firebase Auth UID (または `__defaults__`) |
| `name` | string | トピック名 (Networks、Security...) |
| `form_type` | string | 常に `form_it` |
| `is_active` | boolean | — |
| `sort_order` | number | — |
| `created_at` | timestamp | — |

---

### `decks` — Anki Deck Config

form type と Anki デックのマッピング。各デックのデフォルト設定を保存。

| Field | Type | 説明 |
|---|---|---|
| `id` | string (PK) | Document ID (seed 時 `{defaultId}__{uid}`) |
| `user_id` | string | Firebase Auth UID (または `__defaults__`) |
| `anki_deck_name` | string | Anki 内のデック名 |
| `display_name` | string | UI 上の表示名 |
| `form_type` | string | 対応する form type |
| `language` | string | canonical BCP 47 code (nullable) |
| `default_card_type_ids` | string[] | デフォルトの Card types (seed 時 `{id}__{uid}` で FK 再マップ) |
| `default_category_id` | string | デフォルトの Category (同様に FK 再マップ、nullable) |
| `is_active` | boolean | — |
| `sort_order` | number | — |
| `created_at` | timestamp | — |

---

### `content_types` — フォーム設定 (**SHARED**)

入力フォームの種類を定義。**ユーザーごとではない** — doc ID = `form_type` の値
(`form_language`/`form_it`/`form_general`)、これはアプリ全体のコアルーティングフィールドです。
すべてのユーザーで共有; 管理者のみ編集可 (全員のフォームを変更)。フィールド `fields[]` (form_fields) は
sub-collection ではなくドキュメント内に直接埋め込まれています。

| Field | Type | 説明 |
|---|---|---|
| `id` | string (PK) | = `form_type` (`form_language`/`form_it`/`form_general`) |
| `code` | string | 識別コード |
| `name` | string | 表示名 |
| `description` | string | 説明 |
| `icon` | string | Icon name |
| `fields` | object[] | form_fields の配列 (下記参照) |
| `default_create_mode` | string | `single` / `batch` |
| `is_active` | boolean | — |
| `sort_order` | number | — |
| `created_at` | timestamp | — |
| `updated_at` | timestamp | — |

---

### `form_fields` — フィールド設定

`content_types` 内の **Sub-collection / embedded document**。
入力フォームに表示される各フィールドを定義。

| Field | Type | 説明 |
|---|---|---|
| `id` | string (PK) | Document ID |
| `content_type_id` | string (FK) | `content_types` への参照 |
| `field_key` | string | `entries` 内のフィールドへのキーマッピング |
| `label` | string | フォーム上の表示ラベル |
| `type` | string | `text` / `select` / `textarea`... |
| `is_required` | boolean | 入力必須かどうか |
| `is_session_persistent` | boolean | セッション間で値を保持するか |
| `sort_order` | number | フォーム上のフィールド順序 |
| `placeholder` | string | Placeholder テキスト |
| `data_source` | string | dropdown の場合のデータソース |

---

### `notification_triggers` — LINE リマインダースケジュール (ユーザーごと、管理者専用機能)

LINE push スケジュール設定。ユーザーごと (`user_id`) だが現在は管理者のみ使用可能 (LINE token はアプリ所有者のもの)。

| Field | Type | 説明 |
|---|---|---|
| `id` | string (PK) | Document ID |
| `user_id` | string | Firebase Auth UID |
| `name` | string | トリガー名 |
| `schedule_hours` | number[] | push する時間帯 |
| `timezone` | string | タイムゾーン |
| `deck_filter` / `language_filter` | string[] | リマインドする entry のデッキ名 / canonical BCP 47 code フィルタ |
| `words_per_notification` | number | 1 回の push あたりの単語数 |
| `is_active` | boolean | — |

---

### `review_events` — SRS Revlog (append-only、SRS Phase 0)

`review_state` へのすべての変更履歴 — Anki の revlog に相当。**サーバーのみ書き込み**
(Admin SDK: `line-webhook` + `sync-srs`); クライアントは自分の分のみ読み取り。
FSRS/統計/独立 SRS の基盤 — このログがなければ最新のスナップショットのみが残り、履歴は永久に失われます。

| Field | Type | 説明 |
|---|---|---|
| `user_id` | string | Firebase Auth UID |
| `entry_id` | string | `entries` への参照 |
| `kind` | string | `rating` (LINE/内部 FSRS 経由の rate) · `anki_sync` (Anki からの pull) |
| `rating` | string? | `again`/`hard`/`good`/`easy` — `kind='rating'` の場合のみ存在 |
| `prev` | object \| null | 以前の state スナップショット (`queue`/`interval_days`/`ease_factor`/`due_date`/`lapses`); null = 過去に存在しなかった |
| `next` | object | 新しい state スナップショット (同じ shape) |
| `created_at` | string (ISO) | イベント発生時刻 |

> **Precedence guard (`review_state` の 2 つの書き込みソース):** sync-srs は entry が
> Anki 側のアクティビティより新しく内部で rate 済み (`source:'builtin'`) の場合 **上書きしない**
> (`last_reviewed_at` を AnkiConnect からの `card.mod` と比較; `mod` がない場合のフォールバック:
> `synced_at` と比較 — LINE の進捗を保持する方向に傾く)。`anki_sync` イベントは state が実際に
> 変化した場合のみ記録 (同期のたびのノイズを回避)。

---

### `settings` — 3 種類のドキュメント (シングルトンではなくなりました)

v2.0 から、`settings` コレクションは権限と目的が異なる 3 種類の doc を含みます:

**`settings/{uid}`** — 各ユーザーの preferences (ユーザーが自分のドキュメントを読み書き):

| Field | Type | Default |
|---|---|---|
| `unsplash_enabled` / `tts_enabled` | boolean | `true` — 個人選択 (global flag と AND 結合) |
| `auto_audio` / `auto_image` | boolean | `true` |
| `allow_duplicate` | boolean | `false` |
| `anki_connect_url` | string | `http://localhost:8765` |
| `study_languages` | object[] | `[{ code, display_name, enabled, sort_order }]` — user ごとの BCP 47 学習言語。未設定時は `en`/`ja`/`zh` の legacy defaults |
| `ai_output_language` | string | `'vi'` — AI 生成コンテンツの出力言語 (canonical BCP 47)。`StudyLanguageProvider` がリアルタイム読み込みし、client が `/api/generate` に送信 |

**`settings/global`** — グローバルフィーチャーフラグ (全ユーザー読み込み; `POST /api/admin/global-config` 経由で **管理者のみ書き込み**; `GlobalConfigProvider` 経由でクライアントがリアルタイム読み込み):

| Field | Type | Default | 注記 |
|---|---|---|---|
| `ai_model` | string | `claude-haiku-4-5` | 全ユーザー共通の Claude モデル (generate ルートがここから読み込み) |
| `web_search_enabled` | boolean | `false` | AI エージェントの web_search を有効化 |
| `tts_available` | boolean | `true` | コストゲート: オフ → 全ユーザーが TTS を使用不可 |
| `unsplash_available` | boolean | `true` | コストゲート: オフ → 全ユーザーが Unsplash を使用不可 |

**`settings/default`** — アプリ所有者の SECRETS (**管理者のみ読み書き** — ルールが非管理者をブロック、ネットワーク経由でのトークン漏洩を防止):

| Field | Type | 注記 |
|---|---|---|
| `line_channel_access_token` / `line_user_id` | string | LINE credentials |
| `notifications_enabled` | boolean | LINE 機能のオン/オフ |

> **「有効フラグ」(effective flag)**: `effectiveTts = global.tts_available && user.tts_enabled`。
> 管理者が global をオフにする → 全員使用不可; 再度オンにする → 各ユーザーは以前の個人選択に戻る
> (2 つの doc が分離されているため pref を失わない)。`hooks/useEffectiveMediaFlags.ts` 参照。

---

## コレクション間の関係

```
entries ──(category_id)──► categories
entries ──(topic_ids)────► topics          [many-to-many]
entries ──(card_type_ids)──► card_types    [many-to-many]

decks ──(default_category_id)──► categories
decks ──(default_card_type_ids)──► card_types [many-to-many]

form_fields ──(content_type_id)──► content_types
```

> **Firestore の注記:** JOIN はありません。関係を解決する必要がある場合、
> ID で参照ドキュメントを手動 fetch するか、`Promise.all()` でバッチ fetch する必要があります。

---

## ERD Diagram

Diagram は [eraser.io](https://eraser.io) (diagram-as-code) で作成。
Source file: `docs/database-diagram.txt`

---

## 設計ノート

- `form_type` は複数のコレクションに登場 — これは主要なルーティングフィールドで、
  どの UI フォームが表示され、どのデータが読み込まれるかを決定します。
  **Enum values:**
  | Value | 説明 |
  |---|---|
  | `form_general` | 一般語彙 |
  | `form_it` | IT / テクノロジー語彙 |
  | `form_language` | 言語語彙 (user の `study_languages` で任意の BCP 47 言語を設定) |
- `entries` は最大のコレクションで、多くの optional フィールドを持ちます —
  言語固有のフィールド (pinyin、hiragana...) は対応する `language` の場合のみ値を持ちます。
  英語・中国語・日本語以外は汎用 AI schema (`ipa` など) を使用し、未設定 field を前提にしてはいけません。
- `settings` はシングルトンではなくなりました — 3 種類の doc (`{uid}` / `global` / `default`)、Settings セクション参照。

---

## Security Rules (`firestore.rules` — デプロイ済み)

Client SDK は Firestore を直接読み書き (ミドルウェア + API 認証をバイパス) するため、rules が
最終的な権限レイヤーです。Admin SDK (サーバールート) は rules をバイパス。

| Collection / doc | read | write |
|---|---|---|
| `entries`、`notification_triggers` | 所有者 | 所有者 (作成時は正しい `user_id` を付与必須) |
| `review_events` | 所有者 | **deny** — サーバーのみ書き込み (Admin SDK) |
| `decks`/`categories`/`card_types`/`topics` | 所有者 **+ `__defaults__` は管理者も** | read と同じ |
| `content_types` | ログイン済みの全ユーザー | **管理者のみ** |
| `settings/global` | ログイン済みの全ユーザー | **管理者のみ** |
| `settings/default` | **管理者のみ** | **管理者のみ** |
| `settings/{uid}` | 本人のみ | 本人のみ |
| (その他) | deny | deny |

- **ルール内の管理者** = カスタムクレーム `request.auth.token.admin == true` (ルールは env を読めない
  → サーバー側の `ADMIN_EMAIL` チェックとは異なる)。`scripts/set-admin-claim.ts` で設定、再ログインが必要。
- **Composite index**: `entries (user_id ASC, created_at DESC)` (dashboard/history 用) と
  `content_types (is_active ASC, sort_order ASC)` (create page 用) のみ。その他のユーザーごとのクエリは
  composite index を回避するため意図的に in-memory ソート (`firestore.indexes.json` 参照)。
