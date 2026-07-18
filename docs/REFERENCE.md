# REFERENCE.md

詳細な参照ドキュメント — Claude Code は具体的な情報が必要な場合このファイルを読み込みます。CLAUDE.md のように常に context に保つ必要はありません。

## アーキテクチャ

### リクエストフロー

```
Browser UI ─┬→ AnkiConnect (ユーザーの localhost:8765 — 直接呼び出し、CORS 必須)
            └→ Next.js API Routes → 外部サービス
                                     ├── Firestore (Admin SDK)
                                     ├── Claude API (Anthropic)
                                     ├── Google TTS
                                     └── Unsplash
```

> **AnkiConnect はクライアント側で実行 (2026-07-04 以降):** サーバーは AnkiConnect を呼び出さない (Vercel 上ではサーバーの localhost がユーザーのマシンではない)。すべての Anki コマンドは `lib/flashcard-service/client.ts` (ファクトリ + `settings.anki_connect_url` から URL を解決) と `client-ops.ts` (ensureModel、deck ops、createNotesForEntry、regenerateNotesForEntry) を経由します。パターン: サーバーがデータ返却 → ブラウザが Anki を操作 → ブラウザが結果を POST で返す。

### AnkiConnect CORS セットアップ (必須)

ブラウザが `localhost:8765` を呼び出すのは、デフォルトでは AnkiConnect が CORS をブロックしています (origin `http://localhost` のみを許可)。ユーザーは 1 回設定する必要があります:

1. Anki Desktop → **Tools → Add-ons → AnkiConnect → Config**
2. アプリの origin を `webCorsOriginList` に追加:
    ```json
    {
        "webCorsOriginList": ["http://localhost", "http://localhost:3000", "https://<your-app>.vercel.app"]
    }
    ```
3. **Anki を再起動。**

注意:

- CORS が不足 → ブラウザが `TypeError: Failed to fetch` を報告 ("Anki が閉じている" と区別できない — ブラウザは CORS 詳細を JS に隠す)。Settings ページは Anki がオフラインの場合のガイダンス callout があります。
- **Safari** は HTTPS ページから `http://localhost` へのリクエストをブロック → デプロイメント版は Chrome/Edge/Firefox を使用。

### 主なディレクトリ

| パス                     | 目的                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `app/api/`              | API ルート — すべてのサーバーロジックがここにあります                                      |
| `app/(auth)/`           | ログイン / サインアップページ (サイドバーなしレイアウト)                                    |
| `middleware.ts`         | ルート保護 — `__session` クッキーの存在をチェック                                           |
| `firestore.rules`       | Firestore Security Rules (ユーザーごとの分離; Firebase CLI 経由でデプロイ)                  |
| `app/dashboard/`        | ダッシュボード — 統計概要、最近のエントリ、クイックアクション                               |
| `app/create/`           | カード作成ページ (フォーム選択 + 入力)                                                      |
| `app/preview/`          | 生成されたカードのプレビュー、編集、Anki へのエクスポート                                   |
| `app/history/`          | 作成されたエントリの履歴ログ                                                                |
| `app/history/[id]/`     | 履歴詳細 — 完全なエントリ表示、再作成/削除                                                 |
| `app/settings/`         | 個人設定 (すべてのユーザー) — SRS 同期、カードレイアウト、統合ステータス、設定トグル → `settings/{uid}` |
| `app/settings/admin/`   | アプリ全体の設定 (管理者のみ) — フィーチャー可用性、AI モデル、LINE 通知 gate/schedule → `settings/global` |
| `app/admin/`            | 管理画面 — カテゴリ、カードタイプ、トピック、デック、コンテンツタイプの CRUD                 |
| `components/create/`    | `user_content_types.fields[]` から構築する共通 Create フォームと設定 control                  |
| `components/preview/`   | カードプレビュー + 編集コンポーネント                                                      |
| `components/history/`   | 履歴テーブル、単語詳細カード                                                                |
| `components/admin/`     | リソースごとの管理マネージャーコンポーネント (CategoryManager など)                          |
| `components/layout/`    | ナビゲーションサイドバー、ページヘッダー                                                    |
| `components/ui/`        | 共有 UI プリミティブ (Button、Modal、Card、DataTable など)                                  |
| `lib/`                  | 共有ユーティリティ: firebase、auth、contentTypes、userContentTypes、seed-defaults、session など |
| `lib/ai-agent/`         | Claude AI エージェント — data-driven prompt engine、output profiles、Zod tool schema、provider |
| `lib/flashcard-service/` | クライアント側 AnkiConnect (client.ts + client-ops.ts) — ブラウザ → localhost:8765           |
| `components/providers/` | React contexts: AuthProvider、GlobalConfigProvider、MotionProvider                         |
| `scripts/`              | seed、user/content-type migration、AI output profile backfill、admin claim                     |
| `types/index.ts`        | すべての TypeScript 型と enum                                                               |
| `verify/`               | ランタイム検証フレームワーク (specs、verifiers、harness — `docs/VERIFICATION.md` 参照)      |
| `docs/`                 | 信頼できるドキュメント                                                                      |

### データフロー: 作成 → プレビュー

1. `app/create/page.tsx` が `user_content_types` を `where('user_id', '==', uid)` で読み込み、`code` から built-in/custom routing を解決
2. `lib/create/formBlueprint.ts` が選択した document の `fields[]` から表示順、label、required、session persistence、標準 control を構築し、API generation strategy の payload に workspace `content_type_id` を含める
3. ユーザーが共通 `CardForm` に入力。Primary は `word` / `term` または custom primary、追加 field は `dynamicFields` に含める
4. 送信時、`POST /api/generate` が `user_content_types/{content_type_id}` の owner/routing/profile を server-side で検証し、`ai_output_profiles` から英語 prompt + Zod tool schema を構築して Claude で enrich (General の local strategy を除く)。Profile 未設定 document/request は built-in/generic profile を materialize して同じ engine を使用
5. Provider は model output を schema 検証し、primary を input から復元、legacy alias (`word_type_vi` / `definition_vi`) を補完する
6. `lib/pendingEntry.ts` 経由で `localStorage` に結果を保存 (`ankiflow_pending_result`)
7. ブラウザが `app/preview/page.tsx` にリダイレクトし、pending entry を読み込み。Application/session metadata を AI content より後に merge してから pending をクリア
8. ユーザーがカードを編集、画像/音声を選択、その後:
    - **エクスポート (Anki が開いている):** ブラウザが `createNotesForEntry` を呼び出し (メディア保存 + ノート構築 + デック作成 + AnkiConnect 経由でノート追加) → `POST /api/entries/save` with `status: 'synced'` + note ids
    - **保存 (Anki が閉じている — deferred):** `POST /api/entries/save` with status `reviewed`; sidebar の Sync ボタン経由で後で同期 (`GET /api/entries/sync` → ブラウザがノート作成 → `POST /api/entries/sync`)

### セッション永続化

`lib/session.ts` は Content Type の runtime `form_type` / `code` をキーとして `localStorage` にフォーム状態を保存します。
`fields[].is_session_persistent` が `true` の core/config field は生成成功後も保持し、`false` の field は reset します。
Form 定義から削除された hidden field は generate payload に含めません。入力途中の nonpersistent core field は draft cache が復元します。

### Content Type の scope と lifecycle

- `content_types`: 管理者が `/admin` の「New-user defaults」で編集する global source。3 built-in ID
  (`form_language` / `form_it` / `form_general`) は削除禁止。
- `user_content_types`: Create / Resync が使用する per-user runtime collection。すべての query に
  `where('user_id', '==', uid)` が必要。Settings または `/admin` の「My workspace」でユーザー自身が CRUD する。
- Signup: `seedUserDefaults` が global source を `{sourceId}__{uid}` へ create-only snapshot。後から global を
  編集しても既存ユーザーは変わらない。
- Existing user migration: `migrate:user-content-types` が deterministic ID と workspace `code` を確認し、
  不足分だけを作成。既存 document の update/delete は行わない。
- AI output profiles: `ai_output_profiles[]` が AI の field/schema/instruction を workspace ごとに定義する。
  Language は study language subtag と一致する profile (`en` / `zh` / `ja`) を優先し、それ以外は `default`。
  Primary field は全 profile で必須、reserved application metadata key は不可。既存 global/user built-in の
  profile backfill は別の merge-only migration を使用する。
- Routing: コピー先 document ID ではなく `code` を使用。Built-in alias (`language` / `it` / `general`) は
  `FormType` enum に解決し、custom code は lowercase snake_case のまま使用する。`code` は作成後に変更不可。
  同じ route に解決される競合 documents だけを非表示にして警告し、競合していない types は利用を継続する。

## 環境変数

`.env.example` を `.env` にコピー:

| 変数                                              | ソース                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `FIREBASE_ADMIN_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` | GCP サービスアカウント                                                               |
| `NEXT_PUBLIC_FIREBASE_*`                         | Firebase Console → Project Settings                                                   |
| `ANTHROPIC_API_KEY`                              | Anthropic Console (Claude API)                                                        |
| `GOOGLE_TTS_CREDENTIALS_JSON`                    | GCP サービスアカウント JSON の**中身** (minify 1 行)。serverless (Vercel) では必須 — ファイルが存在しないためパスは使えない |
| `GOOGLE_APPLICATION_CREDENTIALS`                 | GCP サービスアカウント key file への**パス** (ローカル開発用の代替。JSON 版が優先) |
| `UNSPLASH_ACCESS_KEY`                            | Unsplash Developers                                                                   |
| `LINE_CHANNEL_ACCESS_TOKEN`                      | LINE Messaging API の push/reply token                                              |
| `LINE_CHANNEL_SECRET`                            | LINE webhook の署名検証                                                             |
| `NEXT_PUBLIC_LINE_ADD_FRIEND_URL`                | LINE 公式アカウント追加 URL (公開値、Settings UI)                                   |
| `NEXT_PUBLIC_LINE_BOT_ID`                        | LINE 公式アカウントの Basic/Premium ID (`@...`)。Settings の mobile chat deep link と code prefill に使用する公開・任意値 |
| `CRON_SECRET`                                    | `/api/cron/srs-push` の bearer 認証。GitHub Actions secret にも同じ値を設定         |
| `ADMIN_EMAIL`                                    | サーバー側管理者チェック (`/api/admin/global-config`、`/api/admin/content-types` mutation、signup claim) |
| `NEXT_PUBLIC_ADMIN_EMAIL`                        | クライアント側管理者 UI ゲート (表示のみ — セキュリティではない)                    |
| `SIGNUP_ENABLED`                                 | 公開 signup gate。明示的な `true` のみ有効; 未設定・`false`・不正値は無効           |

> GitHub Actions の `SRS LINE Push` workflow には repository secrets `APP_URL` と `CRON_SECRET` が必要。
> 現行アプリ/cron は `LINE_USER_ID` と `SRS_PUSH_TARGET_UID` を使用せず、通知先を `settings/{uid}.line_user_id` から解決する。`LINE_USER_ID` を参照する legacy 手動 script/workflow はクロスユーザー分離を満たさないため実行しない。
> `ANKI_CONNECT_URL` と `API_SECRET`/`x-api-secret` も削除済み。AnkiConnect URL はユーザーごと (`settings/{uid}.anki_connect_url`、フォールバック `http://localhost:8765`); 認証は Firebase セッションクッキーに移行。

公開 signup を切り替えるには server/deployment の `SIGNUP_ENABLED` を変更して restart/redeploy する。
コード変更は不要。

## 認証 (Firebase Auth — マルチユーザー)

- **セッションクッキー `__session`** (httpOnly): ログイン時に Firebase ID トークン → クッキーに変換 `POST /api/auth/session` 経由; ログアウト `DELETE` (取り消し + クリア)。
- **公開サインアップ gate**: server-only の `SIGNUP_ENABLED` を使用。無効時は login の作成リンクを非表示、`/signup` に停止メッセージを表示し、API は Firebase 呼び出し前に 403。既存ユーザーのログインは継続。
- **ミドルウェア** (`middleware.ts`): クッキー存在チェック → ページを `/login` にリダイレクト、`/api/*` → 401 JSON。検証しない (Edge)。除外: `/api/auth/*`、`/api/notifications/line-webhook`、`/verify`、static。
- **API レイヤー** (`lib/auth-guard.ts`): `withAuth(handler(req, ctx, uid))` はクッキーを検証して UID を返す。すべてのルートデータはラップ。管理者ルートは `email === ADMIN_EMAIL` チェックを追加。
- **Firestore Security Rules** (`firestore.rules`): Client SDK はユーザーのドキュメントのみアクセス可。`user_content_types` は owner の read/create/update/delete のみで、update による `user_id` / `code` 変更を拒否。`content_types` は signed-in read + admin write、3 built-in ID は admin でも delete 不可。管理者 = カスタムクレーム `admin:true` (`scripts/set-admin-claim.ts`、再ログイン必須)。デプロイ: `firebase deploy --only firestore:rules,firestore:indexes`.

## スクリプト

```bash
npm run seed                            # content_types + settings/global + settings/default
npm run seed -- --defaults              # テンプレート __defaults__ をパブリッシュ (オプション — サインアップ時に自動遅延パブリッシュ)
npm run migrate:user-content-types      # existing Auth users への create-only migration を dry-run
npm run migrate:user-content-types -- --apply  # レビュー済みの不足 snapshot だけを作成
npm run migrate:ai-output-profiles      # built-in global/user profile update を dry-run
npm run migrate:ai-output-profiles -- --apply  # 明示承認済みで、field 未設定 document だけを update
npm run user:create -- <email>          # 公開 signup を開かず内部アカウントを対話形式で作成 + seed
npx tsx scripts/set-admin-claim.ts <email>       # 管理者クレームを設定 (その後再ログイン)
npx tsx scripts/migrate-user-data.ts <uid> [--dry-run]  # 古いシングルユーザーデータを 1 つのアカウントに割り当て
npx tsx scripts/sync-admin-defaults.ts            # 管理者 workspace → __defaults__ + 既存 user の不足分を dry-run
npx tsx scripts/sync-admin-defaults.ts --apply    # レビュー済みの template 差分・user create を適用
npx tsx scripts/sync-admin-defaults.ts --apply --allow-empty  # template collection の空化を明示的に許可
```

`user:create` は TTY 上で password と確認を非表示入力し、実行確認後に Firebase Auth user を作成して
`seedUserDefaults` を適用する。email が `ADMIN_EMAIL` と一致する場合は `admin:true` claim も設定する。
`SIGNUP_ENABLED` の値には依存しない。claim または seed が失敗した場合、作成済み UID と復旧コマンドを
表示して非ゼロ終了し、user を自動削除しない。

`migrate:user-content-types` は全 Firebase Auth user と global `content_types` を読み、各 workspace の
`user_content_types` を UID の `in` query でまとめて取得します。引数なしは read-only dry-run で、
作成予定 path と ID/code による skip 件数だけを表示します。`--apply` は BulkWriter `create()` のみを使い、
既存 document を update/delete しません。必ず dry-run output をレビューし、Firestore 書き込みの明示的な
承認を得てから `--apply` を実行してください。Apply 後は再度 dry-run し、create candidate が 0 であることを確認します。

`migrate:ai-output-profiles` は global/user の built-in Language/IT documents だけを `code in` query で読み、
`ai_output_profiles` field が存在しない document を update candidate として表示します。引数なしは read-only
dry-run です。`--apply` は transaction 内で field absence を再確認してから merge-only update し、既存 profile、
custom Content Type、General document を変更しません。必ず dry-run output をレビューし、Firestore update の
明示承認を得てから実行してください。Apply 後は自動再読込で candidate が 0 か確認します。

`sync-admin-defaults.ts` は one-time migration。`ADMIN_EMAIL` の `/admin` "My workspace" を
`__defaults__` の正確な snapshot に置き換え、既存 user には ID または論理キーで不足している
master data だけを `create` する。引数なしでは読み取りと差分表示のみで、Firestore への書き込みは
行わない。`--apply` は古い template の削除を含むため、必ず dry-run の全 path をレビューし、
Firestore の書き込み・削除について明示的な承認を得てから 1 回だけ実行する。既存 template がある
collection を空にする差分は `--apply` だけでは拒否され、意図的な場合に限り `--allow-empty` も指定する。
Card type の論理キーは `form_type + language + code` で、同じ code を持つ別言語の card type を混同しない。
既存 user への backfill は document ごとの create とし、計画後に同じ document が作成された競合だけを
skip して他の user の create を継続する。既存 user document の update/delete は行わない。

## Git 規約

**詳細は [`CONTRIBUTING.md`](CONTRIBUTING.md) を参照(単一の情報源)。** 要点:

- ブランチは必ず `develop` から作成(作成前に `git pull` 必須)。命名: `feat/`・`fix/`・`docs/`・`refactor/`・`chore/`・`test/` + 英語 kebab-case slug
- `develop` / `main` への直接コミット・プッシュ禁止(`.githooks/` でブロック)
- コミット: Conventional Commits — type は英語、要約は日本語。例: `feat: エクスポート履歴画面を追加`
- AI エージェントは Co-Authored-By / "Generated with" フッターを付けない
- PR: base = `develop`、タイトルはコミットと同形式、`.github/PULL_REQUEST_TEMPLATE.md` に従う
