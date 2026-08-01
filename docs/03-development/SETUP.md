# 環境構築手順書 — AnkiFlow

| 項目 | 内容 |
| --- | --- |
| 文書ID | AF-SET-001 |
| 版数 | 1.0 |
| 作成日 | 2026-07-31 |
| 最終更新日 | 2026-07-31 |
| 作成者 | [hong-quyen](https://github.com/quyen-doth) |
| ステータス | 運用中 |
| 関連文書 | AF-ARC-001、AF-API-001、AF-DEV-001、AF-OPS-001 |

## 1. 本書の位置づけ

本書は、AnkiFlow をローカル環境で動作させるまでの手順を定義する。対象は、前提となるソフトウェア、外部サービスの準備、環境変数の設定、初期データの投入、および AnkiConnect の設定である。

本書は前身である `docs/PRD.md` 第 13 章「環境変数」を引き継いだものである。旧文書には現在使用していない変数 (`GOOGLE_TTS_API_KEY`、`ANKI_CONNECT_URL`、`API_SECRET`) が記載されていたため、本書では実装を正として一覧を作り直した。

本番環境へのデプロイ手順は運用手順書 (AF-OPS-001) に定める。

## 2. 前提となるソフトウェア

| ソフトウェア | 条件 |
| --- | --- |
| Node.js | CI (`.github/workflows/ci.yml`) は Node.js 20 で検証している。ローカルもこれに合わせることを推奨する |
| npm | Node.js に同梱のもの |
| Git | リポジトリの取得およびフックの設定に用いる |
| Anki Desktop | Anki 連携を確認する場合に必要である |
| AnkiConnect アドオン | Anki Desktop に導入すること |
| ブラウザ | Chrome、Edge、または Firefox。Safari は Anki 連携に使用できない |

<!-- TODO(user): CI は Node.js 20、`.github/workflows/notify.yml` のみ Node.js 24 を指定しており、両者が食い違っている。統一したうえで `.nvmrc` または `engines` フィールドで固定するかを判断すること。 -->

## 3. 外部サービスの準備

いずれも事前にアカウントと資格情報を用意する必要がある。

| サービス | 用途 | 取得するもの |
| --- | --- | --- |
| Firebase | 認証および Firestore | プロジェクト、Web アプリ構成、サービスアカウント鍵 |
| Anthropic | カード内容の生成 | API キー |
| Google Cloud | 音声合成 (Cloud Text-to-Speech) | サービスアカウント鍵 (JSON) |
| Unsplash | 画像の取得 | Developer アプリの Access Key |
| LINE Developers | 復習通知 (任意) | Messaging API チャネルのアクセストークンとシークレット |

LINE 連携を利用しない場合、関連する環境変数は未設定でよい。該当機能が無効になるだけであり、他の機能には影響しない。

## 4. 環境変数

リポジトリ直下の `.env.example` を雛形として `.env.local` を作成し、値を設定する。`.env.local` および実際の値はリポジトリへコミットしてはならない。

以下の各表は、実装が実際に参照している変数を網羅したものである。`.env.example` との差異を認めた場合は実装を正とし、`.env.example` と本書の双方を更新すること。

### 4.1 Firebase (サーバー — Admin SDK)

| 変数 | 内容 |
| --- | --- |
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase プロジェクト ID |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | サービスアカウントのメールアドレス |
| `FIREBASE_ADMIN_PRIVATE_KEY` | サービスアカウントの秘密鍵 |

### 4.2 Firebase (ブラウザ — Client SDK)

| 変数 | 内容 |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Web アプリ構成の API キー |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | 認証ドメイン |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | プロジェクト ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ストレージバケット |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 送信者 ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | アプリ ID |

`NEXT_PUBLIC_` を接頭辞に持つ変数はブラウザへ配布される。秘匿すべき値を置いてはならない。

### 4.3 外部 API

| 変数 | 内容 |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude API のキー |
| `GOOGLE_TTS_CREDENTIALS_JSON` | Google Cloud サービスアカウント鍵の JSON 本体。サーバーレス環境ではこちらを用いる |
| `GOOGLE_APPLICATION_CREDENTIALS` | Google Cloud サービスアカウント鍵ファイルのパス。ローカル環境における代替手段である |
| `UNSPLASH_ACCESS_KEY` | Unsplash Developer の Access Key |

音声合成の資格情報は、`GOOGLE_TTS_CREDENTIALS_JSON` を優先して解決する。

### 4.4 管理者およびアカウント

| 変数 | 内容 |
| --- | --- |
| `ADMIN_EMAIL` | サーバー側の管理者判定に用いるメールアドレス |
| `NEXT_PUBLIC_ADMIN_EMAIL` | 管理者向け UI の表示制御に用いる。セキュリティ機構ではない |
| `SIGNUP_ENABLED` | 公開サインアップの可否。既定は無効であり、文字列 `true` の場合にのみ有効になる |

管理者判定は 2 系統あり、両方を設定する必要がある。サーバー側は `ADMIN_EMAIL`、Firestore Security Rules はカスタムクレーム `admin:true` を参照する。クレームは `scripts/set-admin-claim.ts` で付与するか、`ADMIN_EMAIL` と一致するメールアドレスでサインアップした場合に自動付与される。いずれの場合も、反映には再ログインが必要である。

### 4.5 LINE 通知 (任意)

| 変数 | 内容 |
| --- | --- |
| `LINE_CHANNEL_ACCESS_TOKEN` | Messaging API のアクセストークン |
| `LINE_CHANNEL_SECRET` | Webhook の署名検証に用いるシークレット |
| `NEXT_PUBLIC_LINE_ADD_FRIEND_URL` | 公式アカウントの友だち追加 URL。公開値である |
| `NEXT_PUBLIC_LINE_BOT_ID` | 公式アカウントの Basic / Premium ID (`@` で始まる)。設定画面の deep link と連携コードの事前入力に用いる。公開値かつ任意である |

### 4.6 外部連携および定期実行 (任意)

| 変数 | 内容 |
| --- | --- |
| `INTEGRATION_TOKEN` | 外部システム向けエンドポイントの共有シークレット |
| `INTEGRATION_TARGET_UID` | 外部システムが作成する下書きの所有者となる UID |
| `CRON_SECRET` | 定期実行エンドポイントの共有シークレット |

### 4.7 廃止済みの変数

次の変数は過去に使用していたが、現在は参照していない。旧文書や旧スクリプトに記載が残っている場合があるため、設定してはならない。

| 変数 | 廃止の理由 |
| --- | --- |
| `ANKI_CONNECT_URL` | AnkiConnect の呼び出しがクライアント側へ移行した。接続先は利用者ごとに `settings/{uid}.anki_connect_url` で保持する (既定値は `http://localhost:8765`) |
| `API_SECRET` (`x-api-secret` ヘッダー) | 認証がセッションクッキーへ移行した |
| `GOOGLE_TTS_API_KEY` | サービスアカウント方式へ移行した |
| `LINE_USER_ID`、`SRS_PUSH_TARGET_UID` | 通知先を `settings/{uid}.line_user_id` から解決する方式へ移行した。これらを参照する旧スクリプトは利用者分離を満たさないため実行してはならない |

## 5. 構築手順

### 5.1 依存関係の導入

```bash
git clone <repository-url>
cd ankiflow
npm install
```

`npm install` の際に `prepare` スクリプトが実行され、`git config core.hooksPath .githooks` が設定される。これによりコミットメッセージの検証および保護ブランチへの直接コミットの禁止が有効になる。

### 5.2 環境変数の設定

`.env.example` を `.env.local` へ複製し、第 4 章に従って値を設定する。

### 5.3 Firestore の準備

Firebase コンソールで Firestore を有効化したうえで、Security Rules とインデックスを反映する。

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

Security Rules はクライアントアクセスの拠り所である。反映を怠るとクライアントからの読み書きがすべて拒否される。反映は影響が大きいため、実施前に内容を確認すること。

### 5.4 初期データの投入

```bash
npm run seed
```

新規ユーザー向けの既定マスターデータ (`__defaults__`) と、グローバルなコンテンツタイプを投入する。

### 5.5 利用者の作成

公開サインアップは既定で無効である。開発用の利用者は次のコマンドで作成する。

```bash
npm run user:create
```

### 5.6 開発サーバーの起動

```bash
npm run dev
```

`http://localhost:3000` で起動する。

## 6. AnkiConnect の設定

ブラウザから `localhost:8765` を呼び出すため、AnkiConnect 側でオリジンを許可する必要がある。既定では `http://localhost` のみが許可されている。

1. Anki Desktop で **Tools → Add-ons → AnkiConnect → Config** を開く
2. `webCorsOriginList` にアプリのオリジンを追加する

    ```json
    {
        "webCorsOriginList": ["http://localhost", "http://localhost:3000"]
    }
    ```

3. Anki Desktop を再起動する

設定が不足している場合、ブラウザは `TypeError: Failed to fetch` を返す。この誤りは「Anki が起動していない」場合と区別できない。ブラウザが CORS の詳細を JavaScript へ開示しないためである。

デプロイ済みの環境から利用する場合、`webCorsOriginList` に当該オリジンを追加してもなお接続できないことがある。ブラウザのローカルネットワークアクセス制限によるものであり、アプリケーション側では回避できない。この場合は `http://localhost:3000` から利用するか、ブラウザ側で当該サイトに対する許可を与える必要がある。

## 7. 動作確認

| # | 確認内容 | 手段 |
| --- | --- | --- |
| 1 | 型検査と静的解析が通ること | `npm run lint` |
| 2 | 検証仕様とユニットテストが通ること | `npm run verify` |
| 3 | 画面遷移が動作すること | `npm run test:e2e` (開発サーバーの起動が必要) |
| 4 | 本番ビルドが成功すること | `npm run build` |
| 5 | Anki 連携が動作すること | Anki Desktop を起動し、カードを 1 枚作成して登録する |

検証仕様の書き方はランタイム検証仕様書 (AF-VER-001) に定める。開発時は `/verify` で検証結果を一覧できる。

## 8. スクリプト一覧

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバーを起動する |
| `npm run build` | 本番ビルドを行う |
| `npm run start` | ビルド済みの成果物を起動する |
| `npm run lint` | ESLint を実行する |
| `npm run verify` | 検証仕様とユニットテストを実行する |
| `npm run verify:watch` | 検証を監視モードで実行する |
| `npm run test:e2e` | Playwright による E2E テストを実行する |
| `npm run seed` | 初期データを投入する |
| `npm run user:create` | 利用者を作成する |
| `npm run migrate:*` | データ移行スクリプト群。いずれも dry-run が既定であり、`--apply` で適用する |

移行スクリプトは既存データを変更する。適用前に必ず dry-run で差分を確認し、明示的な承認を得ること。

## 改訂履歴

| 版数 | 日付 | 変更内容 | 変更者 |
| --- | --- | --- | --- |
| 1.0 | 2026-07-31 | 初版作成。`docs/PRD.md` 第 13 章を引き継ぎ、実装を正として環境変数一覧を作り直したうえ、構築手順と動作確認手順を追加した | hong-quyen |
