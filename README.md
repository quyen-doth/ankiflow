<div align="center">

# AnkiFlow

**AI によるコンテンツ自動生成と Anki 連携で、学習カードの作成・管理・復習を一元化するマルチユーザー Web アプリ**

語彙や用語を入力するだけで AI がコンテンツを自動補完。カードタイプやカテゴリはユーザーごとの管理画面で柔軟にカスタマイズでき、LINE 通知による受動的な復習にも対応しています。Firebase 認証によるマルチユーザー対応と、Firestore セキュリティルールによるユーザー間データ分離を実装しています。

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Auth_+_Firestore-Firebase-FFCA28?logo=firebase&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Claude](https://img.shields.io/badge/Claude_API-Anthropic-cc785c?logo=anthropic&logoColor=white)
![Tests](https://img.shields.io/badge/Vitest-1059_passing-success)
![CI](https://github.com/quyen-doth/ankiflow/actions/workflows/ci.yml/badge.svg)

</div>

## 概要

語学学習や技術用語のインプットにおいて、「単語カードを作る手間」は地味に大きく、学習の継続を妨げる要因になります。AnkiFlow は、この「作る・管理する・復習する」の 3 つをひとつのアプリで完結させることを目的に開発したプロジェクトです。

当初は単一ユーザーのローカルファースト設計でしたが、**Firebase 認証によるマルチユーザー対応**へと発展させ、各ユーザーが独立したワークスペース（デッキ・カテゴリ・カードタイプ・学習履歴）を持つ構成に再設計しました。

- **対象コンテンツ**: 語学（英語 / 中国語 / 日本語）、IT 用語、一般知識をはじめ、コンテンツタイプを自由に追加可能
- **連携先**: Anki Desktop（AnkiConnect 経由）/ LINE Messaging API（復習通知）
- **規模**: TypeScript 約 20,000 行（テスト除く） / 79 コンポーネント / 27 API ルート / 14 ページ / 1,059 Vitest + 35 Playwright E2E

## 主な機能

### 認証・マルチユーザー

| 機能                     | 説明                                                                     |
| ------------------------ | ------------------------------------------------------------------------ |
| **メール認証**           | メール + パスワードでの登録（停止中）・ログイン・ログアウト              |
| **セッション Cookie**    | httpOnly セッション Cookie による認証（XSS でトークンを盗まれない）      |
| **ユーザー間データ分離** | Firestore セキュリティルールで、各ユーザーは自分のデータのみ読み書き可能 |
| **初期データの自動生成** | 新規登録時にデフォルトのデッキ・カテゴリ・カードタイプ一式を自動でシード |

### 作成

| 機能                     | 説明                                                                   |
| ------------------------ | ---------------------------------------------------------------------- |
| **AI 自動補完**          | 語彙入力 → Claude API が意味・例文・コロケーション・発音記号などを生成 |
| **画像・音声の自動付与** | Unsplash で関連画像、Google Cloud TTS でネイティブ音声を取得           |
| **重複チェック**         | 同一単語の重複を作成前に自動検出し警告                                 |
| **一括作成**             | 複数の語彙をまとめて作成し、バッチでプレビュー・エクスポート           |
| **遅延同期（後で同期）** | Anki 未起動でもカードを保存し、後からまとめて Anki へ同期可能          |

### 管理

| 機能                   | 説明                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **プレビュー & 編集**  | エクスポート前にカード内容をその場で確認・修正（⌘Enter で即エクスポート）                                                                                |
| **既存カード編集**     | History から既存カードを編集し、Anki ノートに即時同期                                                                                                    |
| **履歴管理**           | 作成済みカードの一覧・詳細表示・再作成・削除                                                                                                             |
| **管理画面（CMS）**    | カテゴリ・カードタイプ・コンテンツタイプ・デッキのユーザー別 CRUD 管理                                                                                   |
| **管理者コントロール** | 管理者はコストのかかる機能（TTS / Unsplash / AI モデル）の全体的な有効・無効切替、および新規ユーザー向けデフォルトの編集を UI から実施（再デプロイ不要） |

### 復習・連携

| 機能                        | 説明                                                                                                                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Anki エクスポート**       | AnkiConnect 経由で複数カードタイプを一括生成（音声・画像メディア同期対応）                                                                                                                                                         |
| **LINE 通知による受動 SRS** | FSRS アルゴリズムに基づき、復習タイミングを LINE に Flex Message で自動プッシュ通知（GitHub Actions cron による毎時実行・管理者が設定した配信時刻を各ユーザーのタイムゾーンで解釈）。Anki Desktop を開かなくても隙間時間に復習可能 |
| **セッション永続化**        | デッキ・言語・タグなどの設定を保持し、次回入力を高速化                                                                                                                                                                             |

## システム構成

```
ブラウザ UI
   │
   ├──▶ AnkiConnect（ユーザー自身の localhost:8765 に直接アクセス / 要 CORS 設定）
   │
   └──▶ Next.js API ルート (app/api/*) ── サーバーは Firestore のみ操作
          ├── Firestore（Admin SDK / セッション Cookie を検証）
          ├── Claude API（コンテンツ生成）
          ├── Google Cloud TTS（音声生成）
          └── Unsplash API（画像取得）
```

**AnkiConnect はクライアントサイドで実行**します。ブラウザがユーザー自身の `localhost:8765` を直接呼び出すため、Vercel などにデプロイしても Anki 連携が動作します（サーバーの localhost はユーザーの端末ではないため、サーバー経由では成立しません）。エクスポート系の処理は「サーバーがデータを返す → ブラウザが Anki を操作 → 結果をサーバーに送り Firestore を更新」というパターンで構成しています。

**カード作成フロー**

1. 作成フォームで語彙を入力 → `POST /api/generate` で Claude API が内容を生成
2. 生成結果を `localStorage` に一時保存し、プレビュー画面へ遷移
3. 内容を確認・編集し、以下のいずれかを実行:
    - **Anki 起動時**: ブラウザが AnkiConnect でメディア保存 → ノート作成し、`POST /api/entries/save` で Firestore に `synced` として保存
    - **Anki 未起動時（遅延同期）**: `POST /api/entries/save` で `reviewed` として保存し、後からサイドバーの Sync でまとめて Anki へ

## 技術スタック

| 領域           | 採用技術                                                                           |
| -------------- | ---------------------------------------------------------------------------------- |
| フレームワーク | Next.js 16（App Router）/ React 19                                                 |
| 言語           | TypeScript（strict モード）                                                        |
| 認証           | Firebase Authentication（メール/パスワード + セッション Cookie）                   |
| データベース   | Cloud Firestore（サーバー: Admin SDK / ブラウザ: Client SDK + セキュリティルール） |
| AI 生成        | Claude API（Anthropic）— Tool-based agent                                          |
| 音声・画像     | Google Cloud TTS / Unsplash API                                                    |
| スタイリング   | Tailwind CSS v4                                                                    |
| 暗記アプリ連携 | AnkiConnect（クライアントから `localhost:8765` へ直接）                            |
| プッシュ通知   | LINE Messaging API                                                                 |
| バリデーション | Zod v4                                                                             |
| ランタイム検証 | Vitest + jsdom（移植・カスタマイズしたランタイム検証基盤）                         |
| E2E テスト     | Playwright（Chromium）                                                             |

## 技術的ハイライト

### 1. 多層防御によるマルチユーザー分離

認証を単一の仕組みに頼らず、責務ごとに層を分けています。

- **セッション Cookie（httpOnly）**: `Authorization` ヘッダーではなく httpOnly Cookie を採用。XSS でトークンが盗まれず、SameSite で CSRF を防ぎ、Next.js のミドルウェアからも参照できます
- **ミドルウェア**: Cookie の存在チェックで未ログインをリダイレクト（`/api/*` は 401 JSON を返却）
- **API 層**: 各ルートでセッション Cookie の署名を実際に検証し、UID を取得してデータをスコープ
- **Firestore セキュリティルール**: クライアント SDK が直接 Firestore を読み書きするため、DB 層でもユーザー間分離を強制。「ブラウザのコンソールから他人のデータを直接クエリしても弾かれる」ことを最終防衛線として担保

### 2. コスト・機能を制御する管理者コントロールプレーン

外部 API（Claude / Google TTS / Unsplash）のコストは管理者が負担するため、ハードコードや再デプロイなしで運用制御できる仕組みを設計しました。

- **グローバル機能フラグ**（`settings/global`）: TTS・Unsplash・AI モデルを全ユーザーに対して有効/無効化。「実効値 = 管理者の可否 AND ユーザー個人の設定」という上限モデルで、無効化しても個人設定は失われません
- **新規ユーザー向けデフォルトの編集**: 既存の管理画面を「テンプレート編集モード」で再利用し、新規登録時に配布されるデフォルトデータをコードではなく UI から編集可能に
- **サーバー側での権限強制**: グローバル設定の書き込みは必ずサーバー API を経由し、環境変数の管理者メールで検証（クライアント側チェックだけに依存しない）

### 3. 移植・カスタマイズしたランタイム検証基盤（`verify/`）

「単体テストでは UI の実挙動まで担保しづらい」という課題に対し、[anthropics/cwc-workshops — phase-3-verify](https://github.com/anthropics/cwc-workshops/tree/main/how-we-claude-code/phase-3-verify) を Next.js App Router + React 19 + Zod 4 向けに移植・カスタマイズしました。実際のコンポーネントをマウントし、操作（クリック・入力）後の DOM を観測して合否を判定します。

- 同一のコードパス（`runFixture()`）が CLI・ブラウザ（`/verify`）・コンソール API の 3 環境で動作
- スキーマ・不変条件・DOM コントラクト・アクセシビリティの 4 種の検証器をプラガブルに追加可能
- Firestore / fetch / Router / 認証コンテキスト / `localStorage` をモック注入し、外部依存のあるコンポーネントも単体で検証
- 1,059 件の Vitest が安定して通過

### 4. 型安全なドメインモデリング

`FormType`・言語種別などの列挙型を `types/index.ts` の単一の真実源として定義。フォームの分岐・AI プロンプト選択・Firestore クエリをすべて型で結びつけ、文字列ハードコードと「サイレントな誤動作」を防いでいます。

### 5. 技術選定の判断 — なぜ Anki に乗せたか

間隔反復（SRS）エンジンを自前でゼロから作るのではなく、実績ある Anki（AnkiConnect 経由）にカードの保存・復習を委ねる構成を選びました。学習継続を支える SRS の核心は堅牢な既存実装に任せ、本アプリは「カードを作る手間をなくす」価値に集中する判断です。

当初はエクスポートをサーバー側から行っていましたが、これはデプロイ環境では成立しない（サーバーの localhost はユーザーの端末ではない）ため、**AnkiConnect 呼び出しをクライアントサイドへ移行**し、デプロイ後もローカルの Anki と連携できるように再構成しました。

## 品質保証

```bash
npm run verify        # 検証マトリクス + 単体テスト（Vitest）
npm run verify:watch  # ウォッチモード
npm run test:e2e      # Playwright E2E（Chromium）
npm run lint          # ESLint
npm run build         # 本番ビルド
```

- Vitest 1,059 件と Playwright E2E 35 件（13 spec）を整備
- 開発時のみアクセスできる検証ダッシュボード `/verify`（本番ビルドでは 404）
- GitHub Actions CI はすべての PR と `main` / `develop` への push で ESLint・`tsc --noEmit`・Vitest を実行
- ローカル Git hooks は `commit-msg` で Conventional Commits 形式・日本語件名・AI co-author 禁止を検証し、`pre-commit` / `pre-push` で `main` / `develop` への直接操作を防止
- 詳細は [`docs/VERIFICATION.md`](docs/VERIFICATION.md) を参照

## ディレクトリ構成

```
ankiflow/
├── app/
│   ├── (auth)/      # ログイン・サインアップ（サイドバーなしレイアウト）
│   ├── api/         # サーバーロジック（27 API ルート、integrations/cron はトークン認証）
│   ├── dashboard/   # 統計サマリー・クイックアクション
│   ├── create/      # カード作成フォーム
│   ├── preview/     # 生成カードの確認・編集・エクスポート（バッチ対応）
│   ├── history/     # 作成履歴の一覧・詳細
│   ├── admin/       # 設定データの管理（CMS / テンプレート編集）
│   └── settings/    # 個人設定（連携状態・各種トグル）
│       └── admin/   # アプリ全体設定（機能可否・AI モデル・LINE 通知、管理者のみ）
├── components/      # UI コンポーネント（79 ファイル）
│   └── providers/   # Auth / GlobalConfig などの React コンテキスト
├── hooks/           # カスタムフック
├── lib/             # 共通ユーティリティ（firebase, auth, ai-agent, flashcard-service, seed-defaults ...）
├── middleware.ts    # ルート保護（セッション Cookie チェック）
├── firestore.rules  # Firestore セキュリティルール（ユーザー間分離）
├── types/           # 型定義・列挙型（ドメインの真実源）
├── verify/          # 移植・カスタマイズしたランタイム検証基盤
├── e2e/             # Playwright E2E テスト
├── scripts/         # seed / migration / admin-claim スクリプト
└── docs/            # 設計ドキュメント
```

## セットアップ

```bash
# 1. 依存インストール
npm install

# 2. 環境変数を設定
cp .env.example .env
# Firebase / Anthropic / Google TTS / Unsplash / LINE / 管理者メールを設定

# 3. Firebase Authentication でメール/パスワードを有効化（Firebase Console）

# 4. 共有データ（content_types / settings）をシード
npm run seed

# 5. Firestore セキュリティルール + インデックスをデプロイ
firebase deploy --only firestore:rules,firestore:indexes --project <project-id>

# 6. 管理者アカウントにカスタムクレームを付与（登録後に 1 回）→ 再ログイン
npx tsx scripts/set-admin-claim.ts <管理者メール>

# 7. 開発サーバーを起動
npm run dev
# → http://localhost:3000
```

主な環境変数:

| 変数                                                | 取得元 / 用途                                                           |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `FIREBASE_ADMIN_*` / `NEXT_PUBLIC_FIREBASE_*`       | Firebase Console（Auth + Firestore）                                    |
| `ANTHROPIC_API_KEY`                                 | Anthropic Console                                                       |
| `GOOGLE_TTS_CREDENTIALS_JSON`                       | GCP サービスアカウント JSON の中身（Vercel などの serverless では必須） |
| `GOOGLE_APPLICATION_CREDENTIALS`                    | GCP サービスアカウント key file のパス（ローカル開発用の代替）          |
| `UNSPLASH_ACCESS_KEY`                               | Unsplash Developers                                                     |
| `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_CHANNEL_SECRET` | LINE Messaging API / webhook                                            |
| `NEXT_PUBLIC_LINE_ADD_FRIEND_URL`                   | LINE 公式アカウント追加 URL                                             |
| `CRON_SECRET`                                       | LINE 通知 cron API の bearer 認証                                       |
| `NEXT_PUBLIC_LINE_BOT_ID`                           | LINE 公式アカウントの ID（モバイル連携ディープリンク用・任意）          |
| `SIGNUP_ENABLED`                                    | 公開サインアップの有効化（`true` のみ有効・既定は無効）                 |
| `ADMIN_EMAIL`                                       | サーバー側の管理者判定用メール                                          |
| `NEXT_PUBLIC_ADMIN_EMAIL`                           | クライアント側の管理者 UI 表示用メール                                  |

> **AnkiConnect の CORS 設定**: ブラウザから `localhost:8765` を呼ぶため、Anki の AnkiConnect アドオン設定で `webCorsOriginList` にアプリのオリジン（`http://localhost:3000` やデプロイ先ドメイン）を追加する必要があります。設定画面に案内を用意しています（Safari は HTTPS ページから localhost への接続を許可しないため、デプロイ環境では Chrome / Edge / Firefox を使用）。
>
> **既知の制約 — ブラウザの Local Network Access (LNA)**: Chrome など最新ブラウザは、デプロイ版（`https://…` の公開オリジン）から `localhost` への通信を **Local Network Access / Private Network Access** ポリシーでブロックします（`webCorsOriginList` を正しく設定しても届きません）。これはブラウザ側のセキュリティ仕様であり、アプリ側のコードでは回避できません。**回避策**: プロンプトが出たら本サイトへローカルネットワークアクセスを許可する、または Anki 連携が必要なときは `http://localhost:3000`（loopback → loopback で制約対象外）からアプリを開いてください。接続失敗時はアプリがこの状況を判定し、適切な案内メッセージを表示します。
>
> AI 生成・プレビュー・保存は Anki なしでも動作します（遅延同期）。
>
> `LINE_USER_ID` を使う legacy 手動 script/workflow はユーザーごとのデータ分離に対応していないため、実行しないでください。現行の通知先は各 user の LINE 連携から解決されます。

## 今後の展望

- 独自 SRS エンジンの実装（Anki Desktop 依存の完全な解消）
- モバイル向け UI 最適化 / 学習状況統計の画面
- LINE 通知の配信履歴・利用量モニタリング
- 複数デバイスからのメモ入力（Chrome 拡張機能などの活用）
- その他の新機能開発し、拡張性向上させる：文法や受験勉強などの学習カード作成

## 作者

個人開発プロジェクトです。要件定義・アーキテクチャ設計・実装・テスト基盤の整備・セキュリティ設計まで一人で担当しました。

- **GitHub**: https://github.com/quyen-doth
