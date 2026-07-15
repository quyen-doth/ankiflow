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
| `app/settings/admin/`   | アプリ全体の設定 (管理者のみ) — フィーチャー可用性、AI モデル、LINE 通知 → `settings/global` + `settings/default` |
| `app/admin/`            | 管理画面 — カテゴリ、カードタイプ、トピック、デック、コンテンツタイプの CRUD                 |
| `components/create/`    | コンテンツタイプごとのフォームコンポーネント                                                |
| `components/preview/`   | カードプレビュー + 編集コンポーネント                                                      |
| `components/history/`   | 履歴テーブル、単語詳細カード                                                                |
| `components/admin/`     | リソースごとの管理マネージャーコンポーネント (CategoryManager など)                          |
| `components/layout/`    | ナビゲーションサイドバー、ページヘッダー                                                    |
| `components/ui/`        | 共有 UI プリミティブ (Button、Modal、Card、DataTable など)                                  |
| `lib/`                  | 共有ユーティリティ: firebase、auth、auth-guard、seed-defaults、session、TTS、Unsplash        |
| `lib/ai-agent/`         | Claude AI エージェント — provider、card schemas (zod)、tool orchestration                   |
| `lib/prompts/`          | AI エージェント用の言語ごとのシステムプロンプト                                            |
| `lib/flashcard-service/` | クライアント側 AnkiConnect (client.ts + client-ops.ts) — ブラウザ → localhost:8765           |
| `components/providers/` | React contexts: AuthProvider、GlobalConfigProvider、MotionProvider                         |
| `scripts/`              | seed-firestore、migrate-user-data、set-admin-claim                                        |
| `types/index.ts`        | すべての TypeScript 型と enum                                                               |
| `verify/`               | ランタイム検証フレームワーク (specs、verifiers、harness — `docs/VERIFICATION.md` 参照)      |
| `docs/`                 | 信頼できるドキュメント                                                                      |

### データフロー: 作成 → プレビュー

1. ユーザーが `app/create/page.tsx` フォームに入力
2. 送信時、`POST /api/generate` を呼び出す → Claude AI エージェントがコンテンツをエンリッチ
3. `lib/pendingEntry.ts` 経由で `localStorage` に結果を保存 (`ankiflow_pending_result`)
4. ブラウザが `app/preview/page.tsx` にリダイレクト、pending entry を読み込みとクリア
5. ユーザーがカードを編集、画像/音声を選択、その後:
    - **エクスポート (Anki が開いている):** ブラウザが `createNotesForEntry` を呼び出し (メディア保存 + ノート構築 + デック作成 + AnkiConnect 経由でノート追加) → `POST /api/entries/save` with `status: 'synced'` + note ids
    - **保存 (Anki が閉じている — deferred):** `POST /api/entries/save` with status `reviewed`; sidebar の Sync ボタン経由で後で同期 (`GET /api/entries/sync` → ブラウザがノート作成 → `POST /api/entries/sync`)

### セッション永続化

`lib/session.ts` は `form_type` をキーとして `localStorage` にフォーム設定 (デック、言語、カードタイプ、タグ) を保存します。コンテンツフィールドはエントリ間でリセット; 設定フィールドはエントリ間で保存されます。

## 環境変数

`.env.example` を `.env` にコピー:

| 変数                                              | ソース                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `FIREBASE_ADMIN_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` | GCP サービスアカウント                                                               |
| `NEXT_PUBLIC_FIREBASE_*`                         | Firebase Console → Project Settings                                                   |
| `ANTHROPIC_API_KEY`                              | Anthropic Console (Claude API)                                                        |
| `GOOGLE_TTS_API_KEY`                             | Google Cloud Console                                                                  |
| `UNSPLASH_ACCESS_KEY`                            | Unsplash Developers                                                                   |
| `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_USER_ID`     | LINE Developers (管理者通知)                                                         |
| `ADMIN_EMAIL`                                    | サーバー側管理者チェック (`/api/admin/global-config`、`/api/notifications/send`、signup claim) |
| `NEXT_PUBLIC_ADMIN_EMAIL`                        | クライアント側管理者 UI ゲート (表示のみ — セキュリティではない)                    |

> `ANKI_CONNECT_URL` と `API_SECRET`/`x-api-secret` は削除されました。AnkiConnect URL はユーザーごと (`settings/{uid}.anki_connect_url`、フォールバック `http://localhost:8765`); 認証は Firebase セッションクッキーに移行。

## 認証 (Firebase Auth — マルチユーザー)

- **セッションクッキー `__session`** (httpOnly): ログイン時に Firebase ID トークン → クッキーに変換 `POST /api/auth/session` 経由; ログアウト `DELETE` (取り消し + クリア)。
- **ミドルウェア** (`middleware.ts`): クッキー存在チェック → ページを `/login` にリダイレクト、`/api/*` → 401 JSON。検証しない (Edge)。除外: `/api/auth/*`、`/api/notifications/line-webhook`、`/verify`、static。
- **API レイヤー** (`lib/auth-guard.ts`): `withAuth(handler(req, ctx, uid))` はクッキーを検証して UID を返す。すべてのルートデータはラップ。管理者ルートは `email === ADMIN_EMAIL` チェックを追加。
- **Firestore Security Rules** (`firestore.rules`、デプロイ済み): Client SDK はユーザーのドキュメントのみアクセス可; 管理者 = カスタムクレーム `admin:true` (`scripts/set-admin-claim.ts`、再ログイン必須)。デプロイ: `firebase deploy --only firestore:rules,firestore:indexes`.

## スクリプト

```bash
npm run seed                            # content_types + settings/global + settings/default
npm run seed -- --defaults              # テンプレート __defaults__ をパブリッシュ (オプション — サインアップ時に自動遅延パブリッシュ)
npx tsx scripts/set-admin-claim.ts <email>       # 管理者クレームを設定 (その後再ログイン)
npx tsx scripts/migrate-user-data.ts <uid> [--dry-run]  # 古いシングルユーザーデータを 1 つのアカウントに割り当て
npx tsx scripts/sync-admin-defaults.ts            # 管理者 workspace → __defaults__ + 既存 user の不足分を dry-run
npx tsx scripts/sync-admin-defaults.ts --apply    # レビュー済みの template 差分・user create を適用
```

`sync-admin-defaults.ts` は one-time migration。`ADMIN_EMAIL` の `/admin` "My workspace" を
`__defaults__` の正確な snapshot に置き換え、既存 user には ID または論理キーで不足している
master data だけを `create` する。引数なしでは読み取りと差分表示のみで、Firestore への書き込みは
行わない。`--apply` は古い template の削除を含むため、必ず dry-run の全 path をレビューし、
Firestore の書き込み・削除について明示的な承認を得てから 1 回だけ実行する。

## Git 規約

**詳細は [`CONTRIBUTING.md`](CONTRIBUTING.md) を参照(単一の情報源)。** 要点:

- ブランチは必ず `develop` から作成(作成前に `git pull` 必須)。命名: `feat/`・`fix/`・`docs/`・`refactor/`・`chore/`・`test/` + 英語 kebab-case slug
- `develop` / `main` への直接コミット・プッシュ禁止(`.githooks/` でブロック)
- コミット: Conventional Commits — type は英語、要約は日本語。例: `feat: エクスポート履歴画面を追加`
- AI エージェントは Co-Authored-By / "Generated with" フッターを付けない
- PR: base = `develop`、タイトルはコミットと同形式、`.github/PULL_REQUEST_TEMPLATE.md` に従う
