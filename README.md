<div align="center">

# AnkiFlow

**AI によるコンテンツ自動生成と Anki 連携で、学習カードの作成を一元化するマルチユーザー Web アプリ**

語彙や用語を入力するだけで、AI が意味・例文・発音を補完し、画像と音声を添えて Anki へ登録します。

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Auth_+_Firestore-Firebase-FFCA28?logo=firebase&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Claude](https://img.shields.io/badge/Claude_API-Anthropic-cc785c?logo=anthropic&logoColor=white)
![Tests](https://img.shields.io/badge/Vitest-1346_passing-success)
![CI](https://github.com/quyen-doth/ankiflow/actions/workflows/ci.yml/badge.svg)

</div>

<!-- TODO(user): 撮影後、次の行のコメントを外してください。ファイルは docs/screenshots/ に置きます。
![カード作成画面](docs/screenshots/create.png)
-->

## 解こうとした課題

語学学習において、単語カードを 1 枚作るには意味・例文・発音・品詞を調べ、画像と音声を用意し、出題方向の違うカードを 1 枚ずつ作る必要があります。この手間が学習の継続を妨げていました。

AnkiFlow は**カードを作る手間をなくすこと**に集中しています。間隔反復による出題と復習は、実績のある Anki に委ねました。判断の経緯は [ADR-0001](docs/adr/0001-delegate-srs-to-anki.md) に記録しています。

## できること

| 領域 | 内容 |
| --- | --- |
| **作成** | 語を入力すると AI が意味・例文・コロケーション・発音を生成。画像 (Unsplash) と音声 (Google Cloud TTS) を自動で付与 |
| **重複検出** | 登録済みの語を生成前に検出して警告 |
| **一括作成** | 複数語をまとめて生成し、個別に確認・破棄 |
| **遅延同期** | Anki 未起動でも保存でき、あとからまとめて登録 |
| **カスタマイズ** | 入力フォーム・カードテンプレート・AI への指示を、コードを触らずに画面から編集 |
| **マルチユーザー** | 利用者ごとに独立したワークスペース。Firestore セキュリティルールで DB 層から分離 |
| **受動的復習** | FSRS に基づき復習期の語を選び、LINE へ配信 |
| **管理者制御** | 費用のかかる機能を全体で有効・無効化 (再デプロイ不要) |

対応するのは語学 (英語・中国語・日本語)、IT 用語、一般知識です。コンテンツタイプは利用者が追加できます。

<!-- TODO(user): 撮影後、次の行のコメントを外してください。
![プレビュー画面](docs/screenshots/preview.png)
-->

## システム構成

```
ブラウザ UI
   │
   ├──▶ AnkiConnect（利用者自身の localhost:8765 へ直接。CORS 設定が必要）
   │
   └──▶ Next.js API ルート ── サーバーは Firestore のみを操作
          ├── Firestore（Admin SDK）
          ├── Claude API
          ├── Google Cloud TTS
          └── Unsplash API
```

**AnkiConnect の呼び出しはブラウザ側で行います。** サーバーの `localhost` は利用者の端末ではないため、サーバー経由では成立しないためです。処理は「サーバーがデータを返す → ブラウザが Anki を操作 → 結果をサーバーへ返す」という形をとります。判断の経緯は [ADR-0002](docs/adr/0002-client-side-ankiconnect.md) に記録しています。

## 技術スタック

| 領域 | 採用技術 |
| --- | --- |
| フレームワーク | Next.js 16 (App Router) / React 19 |
| 言語 | TypeScript (strict) |
| 認証 | Firebase Authentication + httpOnly セッションクッキー |
| データベース | Cloud Firestore (Admin SDK / Client SDK + セキュリティルール) |
| AI 生成 | Claude API — tool ベースのエージェント |
| 音声・画像 | Google Cloud TTS / Unsplash API |
| スタイリング | Tailwind CSS v4 |
| Anki 連携 | AnkiConnect (クライアントから直接) |
| 通知 | LINE Messaging API |
| 検証 | Vitest + jsdom / Playwright |

## 技術的な見どころ

### 多層防御によるデータ分離

認証を 3 層に分け、各層に異なる責務を与えています。ブラウザが Firebase Client SDK で Firestore を直接読むため、アプリケーション層の防御だけでは足りないためです。

| 層 | 担うこと | 限界 |
| --- | --- | --- |
| ミドルウェア | クッキーの存在確認と振り分け | 署名は検証しない |
| API ルート | 署名検証と失効確認 | Admin SDK はルールをバイパスする |
| Firestore ルール | クライアント直接アクセスの所有者判定 | サーバー経由には効かない |

「ブラウザのコンソールから他人のデータを直接クエリしても弾かれる」ことを最終防衛線としています。設計は [ADR-0004](docs/adr/0004-layered-auth-defense.md) を参照してください。

### データ駆動のフォームと AI プロンプト

扱う知識の種類ごとに画面を作るのではなく、Firestore 上の定義から入力フォーム・AI への指示・出力スキーマを組み立てています。新しい種類の学習内容は、コードを書かずに画面から追加できます。

### 移植・カスタマイズしたランタイム検証基盤

[anthropics/cwc-workshops — phase-3-verify](https://github.com/anthropics/cwc-workshops/tree/main/how-we-claude-code/phase-3-verify) を Next.js App Router + React 19 + Zod 4 向けに移植しました。実際のコンポーネントをマウントし、操作後の DOM を観測して合否を判定します。同一のコードパスが CLI・ブラウザ (`/verify`)・コンソール API の 3 環境で動作します。

### 制約を隠さない設計

ブラウザのローカルネットワークアクセス制限により、公開環境から `localhost` の Anki へ到達できない場合があります。**これはアプリ側で回避できません。** 失敗の原因を「Anki 未起動」「CORS 未設定」「ブラウザの制限」に切り分けることも、ブラウザが情報を開示しないため原理的に不可能です。

そのため、ページのオリジンから状況を推定し、複数の可能性を併記して案内する方針をとりました。未解決のリスクは [非機能要件書](docs/01-requirements/NFR.md) に明記しています。

## 規模

2026-08-01 時点。

| 項目 | 数 |
| --- | --- |
| TypeScript | 約 32,000 行 (テスト・検証基盤を除く) |
| コンポーネント | 82 |
| API ルート | 30 |
| ページ | 16 |
| Vitest | 1,346 件 (105 ファイル) |
| Playwright E2E | 60 件 (24 ファイル) |

## 品質保証

```bash
npm run verify        # 検証マトリクス + 単体テスト
npm run test:e2e      # Playwright E2E
npm run lint          # ESLint
npm run build         # 本番ビルド
```

GitHub Actions がすべての PR と `main` / `develop` への push で ESLint・`tsc --noEmit`・Vitest を実行します。ローカルの Git hooks はコミットメッセージの形式と保護ブランチへの直接操作を検証します。

機能要件とテストケースの対応は [テスト計画書](docs/03-development/TEST_PLAN.md) のトレーサビリティマトリクスに定めています。

## セットアップ

構築手順は [環境構築手順書](docs/03-development/SETUP.md) に定めています。概略は次のとおりです。

```bash
npm install
cp .env.example .env           # 各種 API キーを設定
npm run seed                   # 初期データを投入
firebase deploy --only firestore:rules,firestore:indexes
npm run user:create -- <email> # 利用者を作成
npm run dev
```

Anki 連携には、AnkiConnect の設定でアプリのオリジンを `webCorsOriginList` に追加する必要があります。詳細は環境構築手順書の第 6 章をご覧ください。

> Safari は HTTPS ページから `localhost` への接続を許可しないため、Anki 連携には Chrome・Edge・Firefox をお使いください。
> AI 生成・プレビュー・保存は Anki なしでも動作します。

## ドキュメント

設計から運用までの文書を整備しています。索引は [`docs/README.md`](docs/README.md) にあります。

| 目的 | 文書 |
| --- | --- |
| 何を作ったか | [要件定義書](docs/01-requirements/REQUIREMENTS.md) |
| どう作ったか | [アーキテクチャ設計書](docs/02-design/ARCHITECTURE.md) |
| なぜそう作ったか | [アーキテクチャ決定記録](docs/adr/README.md) |
| どう守っているか | [セキュリティ設計書](docs/02-design/SECURITY.md) |
| どう測るか | [効果測定計画書](docs/05-evaluation/EFFECT_MEASUREMENT_PLAN.md) |
| 使い方 | [利用ガイド](docs/06-user/USER_GUIDE.md) / [よくある質問](docs/06-user/FAQ.md) |

今後の開発計画は [ロードマップ](docs/01-requirements/ROADMAP.md) に定めています。

## 作者

個人開発プロジェクトです。要件定義・アーキテクチャ設計・実装・テスト基盤の整備・セキュリティ設計・文書化まで一人で担当しました。

- **GitHub**: https://github.com/quyen-doth
