<div align="center">

# AnkiFlow

**AI によるコンテンツ自動生成と Anki 連携で、学習カードの作成・管理・復習を一元化する Web アプリ**

語彙や用語を入力するだけで AI がコンテンツを自動補完。カードタイプやカテゴリは CMS で柔軟に管理でき、LINE 通知による受動的な復習にも対応しています。

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firestore-Firebase-FFCA28?logo=firebase&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)
![Claude](https://img.shields.io/badge/Claude_API-Anthropic-cc785c?logo=anthropic&logoColor=white)
![Tests](https://img.shields.io/badge/tests-375_passing-success)

</div>

## 概要

語学学習や技術用語のインプットにおいて、「単語カードを作る手間」は地味に大きく、学習の継続を妨げる要因になります。AnkiFlow は、この「作る・管理する・復習する」の 3 つをひとつのアプリで完結させることを目的とした個人開発プロジェクトです。

- **対象コンテンツ**: 語学（英語 / 中国語 / 日本語）、IT 用語、一般知識をはじめ、CMS でコンテンツタイプを自由に追加可能
- **連携先**: Anki Desktop（AnkiConnect 経由）/ LINE Messaging API（復習通知）
- **規模**: TypeScript 約 23,000 行 / 59 コンポーネント / 23 API ルート / 10 ページ / 375 自動テスト

## 主な機能

### 作成

| 機能                     | 説明                                                                   |
| ------------------------ | ---------------------------------------------------------------------- |
| **AI 自動補完**          | 語彙入力 → Claude API が意味・例文・コロケーション・発音記号などを生成 |
| **画像・音声の自動付与** | Unsplash で関連画像、Google Cloud TTS でネイティブ音声を取得           |
| **重複チェック**         | 同一単語・同一言語の重複を作成前に自動検出し警告                       |
| **一括作成**             | 複数の語彙をまとめて作成し、バッチでプレビュー・エクスポート           |

### 管理

| 機能                  | 説明                                                                               |
| --------------------- | ---------------------------------------------------------------------------------- |
| **プレビュー & 編集** | エクスポート前にカード内容をその場で確認・修正（⌘Enter で即エクスポート）          |
| **既存カード編集**    | History から既存カードを編集し、Anki ノートに即時同期                              |
| **履歴管理**          | 作成済みカードの一覧・詳細表示・再作成・削除                                       |
| **管理画面（CMS）**   | カテゴリ・カードタイプ・コンテンツタイプ・デッキの CRUD 管理 + Anki デッキ自動同期 |

### 復習・連携

| 機能                        | 説明                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Anki エクスポート**       | AnkiConnect 経由で複数カードタイプを一括生成（音声メディア同期対応）                                                           |
| **LINE 通知による受動 SRS** | SM-2 アルゴリズムに基づき、復習タイミングを LINE に Flex Message でプッシュ通知。Anki Desktop を開かなくても隙間時間に復習可能 |
| **セッション永続化**        | デッキ・言語・タグなどの設定を保持し、次回入力を高速化                                                                         |

## システム構成

```
ブラウザ UI
   │
   ▼
Next.js API ルート (app/api/*)
   ├── Firestore（Admin SDK）
   ├── AnkiConnect（localhost:8765）
   ├── Claude API（コンテンツ生成）
   ├── Google Cloud TTS（音声生成）
   ├── Unsplash API（画像取得）
   └── LINE Messaging API（SRS 通知）
```

**カード作成フロー**

1. 作成フォームで語彙を入力 → `POST /api/generate` で Claude API が内容を生成
2. 生成結果を `localStorage` に一時保存し、プレビュー画面へ遷移
3. 内容を確認・編集 → `POST /api/anki/create` でカードを Anki に送信 & Firestore に保存

> **設計上の選択（ローカルファースト）**: create → preview 間の一時データとフォーム設定は `localStorage` に保持しています。これはサーバー状態を持たず、単一ユーザーのローカル動作で完結させるための意図的な設計です。AnkiConnect 自体がローカル前提であることとも整合しています。複数ユーザー対応（サーバー側でのセッション・状態管理）は、このトレードオフを理解したうえでの今後の課題です。

## 技術スタック

| 領域           | 採用技術                                                      |
| -------------- | ------------------------------------------------------------- |
| フレームワーク | Next.js 16（App Router）/ React 19                            |
| 言語           | TypeScript（strict モード）                                   |
| データベース   | Cloud Firestore（サーバー: Admin SDK / ブラウザ: Client SDK） |
| AI 生成        | Claude API（Anthropic）— Tool-based agent                     |
| 音声・画像     | Google Cloud TTS / Unsplash API                               |
| スタイリング   | Tailwind CSS v4                                               |
| 暗記アプリ連携 | AnkiConnect（`localhost:8765`）                               |
| プッシュ通知   | LINE Messaging API                                            |
| バリデーション | Zod v4                                                        |
| テスト         | Vitest + jsdom（自作ランタイム検証基盤）                      |

## 技術的ハイライト

### 1. 自作のランタイム検証フレームワーク（`verify/`）

「単体テストでは UI の実挙動まで担保しづらい」という課題に対し、実際のコンポーネントをマウントし、操作（クリック・入力）後に DOM を観測して合否を判定する独自の検証基盤を設計・実装しました。

- 同一のコードパス（`runFixture()`）が CLI・ブラウザ（`/verify`）・コンソール API の 3 環境で動作
- スキーマ・不変条件・DOM コントラクト・アクセシビリティの 4 種の検証器をプラガブルに追加可能
- Firestore / fetch / Router / `localStorage` をモック注入し、外部依存のあるコンポーネントも単体で検証
- 59 コンポーネントを網羅し、375 件のテストが安定して通過

> この基盤を整備する過程で、アクセシビリティ欠陥や非同期処理のフレーキーなテストを検出・修正しました。

### 2. 型安全なドメインモデリング

`FormType`・言語種別などの列挙型を `types/index.ts` の単一の真実源として定義。フォームの分岐・AI プロンプト選択・Firestore クエリをすべて型で結びつけ、文字列ハードコードと「サイレントな誤動作」を防いでいます。

### 3. LINE を使った受動 SRS 学習

SM-2 アルゴリズムで次回復習日を計算し、AnkiConnect から取得した学習状態と Firestore の `review_state` を同期。定期通知で学習カードを LINE に Flex Message で配信します。Anki Desktop を開かなくても隙間時間に復習できる仕組みです。

### 4. 設定駆動の管理画面（CMS）

カテゴリ・カードタイプ・コンテンツタイプ・デッキをコードではなくデータとして管理。フォームの項目構成も Firestore ドキュメントで制御でき、新しいコンテンツタイプの追加にコード変更が不要な構造にしています。

### 5. 技術選定の判断 — なぜ Anki に乗せたか

間隔反復（SRS）エンジンを自前でゼロから作るのではなく、実績ある Anki（AnkiConnect 経由）にカードの保存・復習を委ねる構成を選びました。学習継続を支える SRS の核心は堅牢な既存実装に任せ、本アプリは「カードを作る手間をなくす」価値に集中することで、早期に実利用へ到達することを優先した判断です。

その代償として、エクスポートは Anki Desktop が同一端末で起動している「ローカル動作前提」という制約を負っています。この local 依存を解消する独自 SRS 化は、次のステップとして視野に入れています。

## 品質保証

```bash
npm run verify        # 検証マトリクス + 単体テスト（Vitest）
npm run verify:watch  # ウォッチモード
npm run lint          # ESLint
npm run build         # 本番ビルド
```

- 375 テストが安定して通過（実行順シャッフルでも緑）
- 開発時のみアクセスできる検証ダッシュボード `/verify`（本番ビルドでは 404）
- 詳細は [`docs/VERIFICATION.md`](docs/VERIFICATION.md) を参照

## ディレクトリ構成

```
ankiflow/
├── app/
│   ├── api/         # すべてのサーバーロジック（23 API ルート）
│   ├── dashboard/   # 統計サマリー・クイックアクション
│   ├── create/      # カード作成フォーム
│   ├── preview/     # 生成カードの確認・編集・エクスポート（バッチ対応）
│   ├── history/     # 作成履歴の一覧・詳細
│   ├── admin/       # 設定データの管理（CMS）
│   └── settings/    # 連携状態・各種トグル
├── components/      # UI コンポーネント（59 ファイル）
├── hooks/           # カスタムフック
├── lib/             # 共通ユーティリティ（firebase, ai-agent, tts, unsplash, session ...）
├── types/           # 型定義・列挙型（ドメインの真実源）
├── verify/          # 自作ランタイム検証フレームワーク
└── docs/            # 設計ドキュメント
```

## セットアップ

```bash
# 1. 依存インストール
npm install

# 2. 環境変数を設定
cp .env.example .env
# Firebase / Anthropic / Google TTS / Unsplash / LINE のキーを設定

# 3. 開発サーバーを起動
npm run dev
# → http://localhost:3000
```

主な環境変数:

| 変数                                          | 取得元                            |
| --------------------------------------------- | --------------------------------- |
| `FIREBASE_ADMIN_*` / `NEXT_PUBLIC_FIREBASE_*` | Firebase Console                  |
| `ANTHROPIC_API_KEY`                           | Anthropic Console                 |
| `GOOGLE_TTS_API_KEY`                          | Google Cloud Console              |
| `UNSPLASH_ACCESS_KEY`                         | Unsplash Developers               |
| `LINE_CHANNEL_ACCESS_TOKEN` / `LINE_USER_ID`  | LINE Developers                   |
| `API_SECRET`                                  | 管理系 API の認証用ランダム文字列 |

> Anki へのエクスポート機能には **Anki Desktop の起動と AnkiConnect プラグイン**（`localhost:8765`）が必要です。AI 生成・プレビューは Anki なしでも確認できます。

## 今後の展望

- 独自 SRS エンジンの実装（Anki Desktop 依存の解消）
- 複数ユーザー対応
- モバイル向け UI 最適化
- 学習状況統計の画面
- 複数デバイスからのメモ入力（Chrome 拡張機能などの活用）

## 作者

個人開発プロジェクトです。要件定義・アーキテクチャ設計・実装・テスト基盤の整備まで一人で担当しました。

- **GitHub**: https://github.com/quyen-doth
