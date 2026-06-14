<div align="center">

# AnkiFlow 📚

**AI で単語カードづくりを自動化する、多言語学習者のための Web アプリケーション**

語彙を入力 → AI が例文・発音・画像を自動生成 → 内容を確認・編集 → Anki にエクスポート

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firestore-Firebase-FFCA28?logo=firebase&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-API-4285F4?logo=google&logoColor=white)
![Tests](https://img.shields.io/badge/tests-269_passing-success)

</div>

## 📖 概要

語学学習において「単語カードを作る作業」は地味に時間がかかり、継続の妨げになります。**AnkiFlow** は、単語やIT用語を入力するだけで AI（Google Gemini）が意味・例文・コロケーション・発音記号などを自動生成し、ワンクリックで [Anki](https://apps.ankiweb.net/)（定番の暗記アプリ）に取り込めるようにすることで、この「作る手間」をなくすことを目的としています。

- **対象コンテンツ**: 語学（英語 🇺🇸 / 中国語 🇨🇳 / 日本語 🇯🇵）、IT用語、一般知識
- **連携先**: ローカルで動作する Anki Desktop（AnkiConnect プラグイン経由）
- **規模**: TypeScript 約 14,000 行 / 45 コンポーネント / 15 API ルート / 10 ページ / 269 自動テスト

## ✨ 主な機能

| 機能                         | 説明                                                                     |
| ---------------------------- | ------------------------------------------------------------------------ |
| 🤖 **AI による自動補完**     | 単語を入力すると Gemini が意味・例文・発音・関連語などを生成             |
| 🖼️ **画像・音声の自動付与**  | Unsplash で関連画像、Google Cloud TTS でネイティブ音声を取得             |
| 👀 **プレビュー & 編集**     | エクスポート前にカード内容をその場で確認・修正                           |
| 📤 **Anki へのエクスポート** | AnkiConnect 経由で複数のカードタイプを一括生成                           |
| 🗂️ **履歴管理**              | 作成済みカードの一覧・詳細表示・再作成・削除                             |
| ⚙️ **管理画面（CMS）**       | カテゴリ・カードタイプ・デッキ・トピックなどの設定データを CRUD で管理   |
| 💾 **セッション永続化**      | デッキ・言語・タグなどの設定を `localStorage` に保持し、次回入力を高速化 |

## 🖼️ スクリーンショット

画面キャプチャは `docs/screenshots/` に以下のファイル名で配置します。

```
docs/screenshots/
├── dashboard.png   # ダッシュボード
├── create.png      # カード作成
└── preview.png     # プレビュー
```

<!-- 上記の画像を配置したら、このコメントを外して掲載してください:
| ダッシュボード | カード作成 | プレビュー |
|---|---|---|
| ![dashboard](docs/screenshots/dashboard.png) | ![create](docs/screenshots/create.png) | ![preview](docs/screenshots/preview.png) |
-->

## 🛠️ 技術スタック

| 領域           | 採用技術                            | 選定理由                                                    |
| -------------- | ----------------------------------- | ----------------------------------------------------------- |
| フレームワーク | **Next.js 16**（App Router）        | サーバーコンポーネントと API ルートを単一コードベースで管理 |
| 言語           | **TypeScript**（strict モード）     | `any` を排し、型でドメインの整合性を担保                    |
| データベース   | **Cloud Firestore**                 | サーバーは Admin SDK、ブラウザは Client SDK を使い分け      |
| スタイリング   | **Tailwind CSS v4**                 | デザイントークンに基づく一貫した UI                         |
| AI 生成        | **Google Gemini API**               | 語彙コンテンツのエンリッチ                                  |
| 音声 / 画像    | **Google Cloud TTS / Unsplash API** | ネイティブ発音・関連画像の取得                              |
| 暗記アプリ連携 | **AnkiConnect**（`localhost:8765`） | ローカル HTTP API でカードを直接生成                        |
| バリデーション | **zod 4**                           | API 入出力・フォームのスキーマ検証                          |
| テスト         | **Vitest + jsdom**                  | 自作のランタイム検証基盤を駆動（後述）                      |

## 🏗️ システム構成

ブラウザ UI から Next.js の API ルートを介して各外部サービスにアクセスする構成です。**サーバーロジックはすべて API ルートに集約**し、クライアントとサーバーの責務を明確に分離しています。

```
ブラウザ UI
   │
   ▼
Next.js API ルート (app/api/*)  ──┬── Firestore（Admin SDK）
                                 ├── AnkiConnect（localhost:8765）
                                 ├── Gemini API（コンテンツ生成）
                                 ├── Google Cloud TTS（音声生成）
                                 └── Unsplash API（画像取得）
```

**カード作成のデータフロー（Create → Preview → Anki）**

1. 作成フォームで語彙を入力し、`POST /api/generate` で Gemini が内容を生成
2. 生成結果を `localStorage`（`ankiflow_pending_result`）に一時保存
3. プレビュー画面へ遷移し、内容を読み込み・編集
4. `POST /api/anki/create` で AnkiConnect にカードを送信し、Firestore に履歴を保存

> **設計上の選択（ローカルファースト）**: create → preview 間の一時データ（`lib/pendingEntry.ts` / `ankiflow_pending_result`）と、デッキ・言語・タグなどのフォーム設定（`lib/session.ts` / `ankiflow_session_*`）は `localStorage` に保持しています。これはサーバー状態を持たず単一ユーザーのローカル動作で完結させるための意図的な設計で、AnkiConnect がローカル前提であることとも整合します。複数ユーザー対応（サーバー側でのセッション・状態管理）はこのトレードオフを理解したうえでの今後の課題です。

## 💡 技術的ハイライト

採用担当の方に特に見ていただきたい、設計・実装上の工夫です。

### 1. 自作のランタイム検証フレームワーク（`verify/`）

「単体テストでは UI の実挙動まで担保しづらい」という課題に対し、**実際のコンポーネントをマウントし、操作（クリック・入力）した後に DOM を観測して合否を判定する**独自の検証基盤を設計・実装しました。

- **同一のコードパス**（`runFixture()`）が 3 つの実行環境（CI のターミナル / ブラウザのダッシュボード `/verify` / エージェント用コンソール API）を兼ねる
- **プラガブルな 4 種の検証器**（スキーマ・不変条件・DOM コントラクト・アクセシビリティ）を、コンポーネントを改変せず追加可能
- Firestore / fetch / ルーター / `localStorage` を**モック注入**し、外部依存のあるコンポーネントも単体で検証
- **45 のコンポーネント／フィーチャー**を網羅し、**269 件のテストが通過**

> この基盤を整備する過程で、アクセシビリティ欠陥（ラベル未設定のフォーム）や非同期処理のフレーキーなテストを検出・修正しました。**テスト容易性を起点に設計・品質を改善する**という実務的な視点を重視しています。

### 2. 型安全なドメインモデリング

`FormType` や言語種別などの**列挙型を単一の真実源**（`types/index.ts`）として定義し、フォームの分岐・Gemini プロンプトの選択・Firestore クエリのすべてを型で結びつけています。文字列のハードコードを禁じ、設定ミスによる「サイレントな誤動作」を防いでいます。

### 3. 外部サービスのオーケストレーションとエラーハンドリング

AnkiConnect は**ローカルでのみ動作する**ため、未接続時を含むあらゆる失敗ケースを明示的にハンドリングしています。AI・TTS・画像取得といった複数の非同期処理を協調させつつ、ユーザーには進捗をステップ表示します。

### 4. 設定駆動の管理画面（CMS）

カテゴリ・カードタイプ・デッキなどの設定を**コードではなくデータとして管理**できる管理画面を実装。フォームの項目構成まで Firestore のドキュメントで制御でき、機能追加に強い構造にしています。

### 5. 技術選定の判断 — なぜ Anki に乗せたか

間隔反復（SRS）エンジンを自前でゼロから作るのではなく、実績ある **Anki**（AnkiConnect 経由）にカードの保存・復習を委ねる構成を選びました。学習継続を支える SRS の核心は堅牢な既存実装に任せ、本アプリは「カードを作る手間をなくす」価値に集中することで、早期に実利用へ到達することを優先した判断です。その代償として、エクスポートは Anki Desktop が同一端末で起動している「ローカル動作前提」という制約を負っています。この local 依存を解消する独自 SRS 化は、次のステップとして視野に入れています。

## ✅ 品質保証・テスト

```bash
npm run verify        # 検証マトリクス + 単体テスト（Vitest）
npm run verify:watch  # ウォッチモード
npm run lint          # ESLint
npm run build         # 本番ビルド
```

- **269 テストが安定して通過**（実行順をシャッフルしても緑であることを確認済み）
- 開発時のみアクセスできる検証ダッシュボード `/verify`（本番ビルドでは 404・検証用の DOM 属性も出力されません）
- 詳細は [`docs/VERIFICATION.md`](docs/VERIFICATION.md) を参照

## 📂 ディレクトリ構成

```
ankiflow/
├── app/
│   ├── api/         # すべてのサーバーロジック（API ルート）
│   ├── dashboard/   # 統計サマリー・クイックアクション
│   ├── create/      # カード作成フォーム
│   ├── preview/     # 生成カードの確認・編集・エクスポート
│   ├── history/     # 作成履歴の一覧・詳細
│   ├── admin/       # 設定データの管理（CMS）
│   └── settings/    # 連携状態・各種トグル
├── components/      # UI コンポーネント（ui / create / preview / history / admin / layout）
├── lib/             # 共通ユーティリティ（firebase, gemini, tts, unsplash, session ...）
├── types/           # 型定義・列挙型（ドメインの真実源）
├── verify/          # 自作ランタイム検証フレームワーク
└── docs/            # 設計ドキュメント（source of truth）
```

## 🚀 セットアップ

```bash
# 1. リポジトリ直下の ankiflow/ で依存をインストール
cd ankiflow
npm install

# 2. 環境変数を設定（.env.example をコピー）
cp .env.example .env.local
# Firebase / Gemini / Google TTS / Unsplash のキーを設定

# 3. 開発サーバーを起動
npm run dev
# → http://localhost:3000
```

> Anki へのエクスポート機能を試すには、**Anki Desktop を起動**し、AnkiConnect プラグインを導入してください（`localhost:8765`）。AI 生成やプレビューまではローカルのみで確認できます。

主な環境変数:

| 変数                                          | 取得元                            |
| --------------------------------------------- | --------------------------------- |
| `FIREBASE_ADMIN_*` / `NEXT_PUBLIC_FIREBASE_*` | Firebase Console                  |
| `GEMINI_API_KEY`                              | Google AI Studio                  |
| `GOOGLE_TTS_API_KEY`                          | Google Cloud Console              |
| `UNSPLASH_ACCESS_KEY`                         | Unsplash Developers               |
| `API_SECRET`                                  | 管理系 API の認証用ランダム文字列 |

## 🗺️ 今後の展望

- フック（`useSession` 等）の単体テスト追加（`renderHook` ツールの導入）
- 本番ビルドでの検証実行への対応
- 複数ユーザー対応（現状はローカル単一ユーザー想定）

## 👤 作者について

個人開発のプロジェクトです。要件定義からアーキテクチャ設計、実装、テスト基盤の整備までを一人で担当しました。

- **GitHub**: https://github.com/quyen-doth

ご覧いただきありがとうございます。ご質問やフィードバックがあればお気軽にご連絡ください。
