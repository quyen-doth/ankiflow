# テスト計画書 — AnkiFlow

| 項目 | 内容 |
| --- | --- |
| 文書ID | AF-TST-001 |
| 版数 | 1.0 |
| 作成日 | 2026-07-31 |
| 最終更新日 | 2026-07-31 |
| 作成者 | [hong-quyen](https://github.com/quyen-doth) |
| ステータス | 運用中 |
| 関連文書 | AF-REQ-001、AF-VER-001、AF-SET-001、AF-DEV-001 |

## 1. 本書の位置づけ

本書は、AnkiFlow における試験の方針、種別、実施手段、および機能要件との対応を定義する。

検証仕様 (`verify/`) の記述方法そのものはランタイム検証仕様書 (AF-VER-001) に定める。本書は**何をどこまで担保しているか**を扱い、書き方は扱わない。

本書に記載する件数は 2026-07-31 時点 (v0.13.1) の実測値である。

## 2. 方針

### 2.1 基本的な考え方

本プロジェクトは単独開発であり、専任の試験担当者を置かない。したがって、人手による確認に依存しない構成を採る。

| # | 方針 |
| --- | --- |
| 1 | 自動化できるものは自動化し、手動確認は自動化が原理的に困難な範囲に限る |
| 2 | 外部サービスに依存する試験は、実サービスを呼ばずに代替物へ置き換える |
| 3 | 利用者間のデータ分離に関わる箇所は、必ず自動試験で担保する |
| 4 | 試験そのものが機能していることを確認する仕組みを持つ |

方針 4 は、意図的に失敗する検証項目を用意し、それらが実際に失敗することを確認する方式で実現する。試験が常に成功する状態に陥っていないことを保証するためである。

### 2.2 自動化できない範囲

次の項目は自動試験の対象外とし、手動で確認する。いずれも利用者の端末環境そのものに依存するためである。

| 項目 | 理由 |
| --- | --- |
| Anki Desktop への実際の登録 | 利用者端末で動作する外部アプリケーションを要する |
| 作成したカードの Anki 上での表示 | 同上 |
| AnkiWeb 同期後の他端末での学習 | 同上 |
| LINE への実際の配信 | 外部プラットフォームへの実送信を伴う |
| ブラウザのローカルネットワークアクセス制限の挙動 | ブラウザとその設定に依存する |

## 3. 試験の種別

| 種別 | 手段 | 対象 | 件数 |
| --- | --- | --- | --- |
| 単体試験 | Vitest (jsdom) | ロジック、API ルート、データ変換、移行スクリプト | 98 ファイル |
| 検証仕様 | 独自フレームワーク + Vitest | コンポーネントの実行時のふるまい | 72 ファイル (component 62、feature 14) |
| E2E 試験 | Playwright | 画面をまたぐ操作の流れ | 24 ファイル |
| 静的検査 | ESLint、TypeScript | 記述規約、型 | — |

単体試験と検証仕様は同一の実行系で動作する。`npm run verify` の実測は **105 ファイル / 1,346 件、全件成功**である。

### 3.1 検証仕様の位置づけ

検証仕様は、コンポーネントを実際に描画したうえで、その結果を DOM の表面から観察する方式を採る。React の内部構造を読まず、描画結果の画像比較も行わない。

構造上の理由により、本番ビルドでは検証用の属性が出力されない。したがって検証は開発およびテスト環境でのみ成立する。これは確定した方針である。

### 3.2 外部依存の扱い

| 依存先 | 試験時の扱い |
| --- | --- |
| Firestore | 代替実装に差し替える。対応する操作は等価比較、`in`、1 項目の並べ替え、および基本的な読み書きに限る |
| Claude API | 応答を固定した代替物に差し替える |
| Google Cloud TTS | 同上 |
| Unsplash API | 同上 |
| AnkiConnect | HTTP 呼び出しを代替物に差し替える |
| ルーティング、`localStorage` | 代替物に差し替える |

代替した Firestore が対応していない操作を用いるコンポーネントは、代替実装を拡張しなければ試験できない。

## 4. 試験ケースの識別

試験ケースには `TC-nnn` を付与する。本書における 1 件の試験ケースは、**1 つの機能要件を担保する試験の集合**を指し、個々の `it()` を指すものではない。要件との対応を追跡できる粒度に揃えるためである。

## 5. トレーサビリティマトリクス

機能要件 (`FR-nnn`) と試験ケース (`TC-nnn`) の対応を示す。「実装箇所」は主たる試験の所在であり、網羅的な列挙ではない。

### 5.1 認証・アカウント

| TC-ID | 対象要件 | 確認内容 | 実装箇所 |
| --- | --- | --- | --- |
| TC-001 | FR-001 | ログインとログアウトが成立すること | `verify/unit/auth-client`、`auth-provider` |
| TC-002 | FR-002 | セッションクッキーの検証、失効の反映、未認証時の遮断 | `verify/unit/auth-guard`、`middleware`、`session` |
| TC-003 | FR-003 | 利用者ごとのデータ分離が保たれること | `verify/unit/firestore-entry-rules`、`entry-query-route-guards` |
| TC-004 | FR-004 | 新規登録時に初期マスターデータが生成されること | `verify/unit/account-provisioning`、`seed-defaults` |
| TC-005 | FR-005 | 公開サインアップの可否が正しく制御されること | `verify/unit/signup-policy`、`signup-route`、`e2e/signup-availability` |

### 5.2 カード作成

| TC-ID | 対象要件 | 確認内容 | 実装箇所 |
| --- | --- | --- | --- |
| TC-010 | FR-010 | コンテンツタイプ定義から入力フォームが構築されること | `verify/unit/form-blueprint`、`verify/specs/configured-card-form`、`e2e/user-content-types-runtime` |
| TC-011 | FR-011 | AI 生成が構造化された結果を返し、検証を通ること | `verify/unit/generate-route`、`ai-card-schemas`、`prompt-engine`、`claude-agent-provider` |
| TC-012 | FR-012 | 入力語から学習言語を判定できること | `verify/unit/language-detect-route`、`language-detection`、`script-detection` |
| TC-013 | FR-013 | 学習言語を正として入力語が変換されること | `verify/unit/term-resolution`、`resolve-terms-route` |
| TC-014 | FR-014 | 画像を取得し、必要に応じて圧縮できること | `verify/unit/image-compress`、`e2e/image-compression` |
| TC-015 | FR-015、FR-016 | 単語音声および例文音声を生成できること | `verify/unit/tts`、`tts-client-options`、`audio-generate-route` |
| TC-017 | FR-017 | 登録済みの語を検出して警告すること | `verify/unit/check-duplicate-route`、`duplicate-lookup` |
| TC-018 | FR-018 | 複数語の一括作成が成立すること | `verify/unit/batch-generate`、`verify/specs/batch-item-list`、`e2e/create-batch-shortcut` |
| TC-019 | FR-019 | 入力途中の内容が保持されること | `verify/unit/create-draft-cache` |
| TC-020 | FR-020 | 入力条件がコンテンツタイプごとに保持されること | `verify/unit/session`、`pending-entry`、`pending-batch` |

### 5.3 プレビューと編集

| TC-ID | 対象要件 | 確認内容 | 実装箇所 |
| --- | --- | --- | --- |
| TC-030 | FR-030 | 生成結果が正しく描画されること | `verify/specs/card-preview`、`verify/unit/card-html-preview`、`render-card` |
| TC-031 | FR-031 | 各項目を編集できること | `verify/specs/editable-field`、`collocation-editor` |
| TC-032 | FR-032 | カードの表裏を切り替えられること | `e2e/card-preview-flip` |
| TC-033 | FR-033 | 画像を差し替え、自動的に縮小できること | `verify/unit/image-compress`、`card-validation-image` |
| TC-034 | FR-034 | 一括作成時に個別のカードを破棄できること | `verify/unit/discard-batch-entry`、`verify/specs/batch-preview-discard` |

### 5.4 Anki 連携

| TC-ID | 対象要件 | 確認内容 | 実装箇所 |
| --- | --- | --- | --- |
| TC-040 | FR-040 | ノートタイプの用意とノート作成が成立すること | `verify/unit/anki-client-ops`、`anki-client`、`build-notes`、`anki-export-flow` |
| TC-041 | FR-041 | メディアが Anki へ保存されること | `verify/unit/extract-media`、`media-data-url` |
| TC-042 | FR-042 | Anki 未起動時に保存し、後から同期できること | `verify/unit/anki-export-flow`、`anki-connection-error` |
| TC-043 | FR-043 | 編集内容が Anki へ反映されること | `verify/unit/regenerate-entry-notes`、`history-entry-updates`、`entry-transaction-update` |
| TC-044 | FR-044 | Anki のノートを削除できること | `verify/unit/anki-drain-pending-deletions` |

### 5.5 履歴とダッシュボード

| TC-ID | 対象要件 | 確認内容 | 実装箇所 |
| --- | --- | --- | --- |
| TC-050 | FR-050 | 履歴の一覧表示と絞り込みが成立すること | `verify/unit/history-client`、`history-filter-entries`、`history-query`、`e2e/history-content-type-filter` |
| TC-051 | FR-051 | 履歴の詳細を表示できること | `verify/specs/word-detail-card` 相当、`verify/unit/entry-custom-fields` |
| TC-052 | FR-052 | 履歴から再作成できること | `verify/unit/preview-topic-mapping` |
| TC-053 | FR-053 | 個別削除と一括削除が成立すること | `verify/unit/history-bulk-delete-route`、`e2e/history-table-selection` |
| TC-054 | FR-054 | 統計が正しく集計されること | `verify/unit/dashboard-client`、`dashboard-query`、`e2e/dashboard-api` |

### 5.6 マスターデータ管理

| TC-ID | 対象要件 | 確認内容 | 実装箇所 |
| --- | --- | --- | --- |
| TC-060 | FR-060 | カテゴリを管理できること | `verify/specs/category-manager`、`category-selector` |
| TC-061 | FR-061 | カードタイプとテンプレートを管理できること | `verify/specs/card-type-manager`、`card-template-editor`、`verify/unit/card-type-validation`、`card-template-fields` |
| TC-062 | FR-062 | コンテンツタイプと AI 出力プロファイルを管理できること | `verify/specs/content-type-manager`、`content-type-editor-page`、`ai-output-profiles-editor`、`e2e/content-type-ai-output-profiles` |
| TC-063 | FR-063 | デッキを管理できること | `verify/specs/deck-manager`、`deck-selector`、`verify/unit/suggest-anki-deck-name` |
| TC-064 | FR-064 | トピックを管理できること | `e2e/create-it-topic` |
| TC-065 | FR-065 | 学習言語および出力言語を設定できること | `verify/unit/study-languages`、`ai-output-languages`、`language-catalog`、`e2e/ai-output-languages` |

### 5.7 管理者機能

| TC-ID | 対象要件 | 確認内容 | 実装箇所 |
| --- | --- | --- | --- |
| TC-070 | FR-070 | 機能フラグの切り替えと権限判定が正しいこと | `verify/unit/global-config-route`、`notification-config` |
| TC-071 | FR-071 | 新規利用者向け既定データを編集できること | `verify/unit/admin-default-sync`、`verify/specs/admin-page` 相当 |
| TC-072 | FR-072 | AI モデルの選択が反映されること | `verify/unit/ai-settings-cache` |

### 5.8 復習通知

| TC-ID | 対象要件 | 確認内容 | 実装箇所 |
| --- | --- | --- | --- |
| TC-080 | FR-080 | LINE アカウントを連携できること | `verify/unit/line-link-route`、`line-webhook-route`、`line-deep-link`、`e2e/line-notification-settings` |
| TC-081 | FR-081 | 復習期日の算出と優先順位付けが正しいこと | `verify/unit/srs-fsrs`、`srs-precedence`、`srs-webhook-handler` |
| TC-082 | FR-082 | 定期通知が正しい対象へ配信されること | `verify/unit/cron-srs-push`、`notifications-send` |
| TC-083 | FR-083 | 配信時刻の判定が利用者のタイムゾーンで行われること | `verify/unit/notification-schedule` |

### 5.9 要件に紐づかない試験

次の試験は特定の機能要件に対応しないが、品質の維持に必要である。

| 対象 | 確認内容 | 実装箇所 |
| --- | --- | --- |
| データ移行 | 移行スクリプトが既存データを壊さないこと | `verify/unit/*-migration`、`output-language-control-backfill` |
| 外部連携 | 共有シークレットによる保護と所有者の固定 | `verify/unit/integration-term-drafts` |
| 共通 UI | ボタン、モーダル、表などの基本的なふるまい | `verify/specs/` の各コンポーネント仕様 |
| 未保存の変更 | 離脱時に確認が働くこと | `verify/unit/unsaved-changes-guard`、`e2e/settings-unsaved-changes` |

## 6. 網羅状況

| 要件区分 | 要件数 | 試験ケース数 | 網羅 |
| --- | --- | --- | --- |
| 認証・アカウント | 5 | 5 | 全件 |
| カード作成 | 11 | 10 | 全件 (TC-015 が FR-015 と FR-016 を担う) |
| プレビューと編集 | 5 | 5 | 全件 |
| Anki 連携 | 5 | 5 | 全件 |
| 履歴とダッシュボード | 5 | 5 | 全件 |
| マスターデータ管理 | 6 | 6 | 全件 |
| 管理者機能 | 3 | 3 | 全件 |
| 復習通知 | 4 | 4 | 全件 |

すべての機能要件に対応する試験ケースが存在する。ただし**対応する試験が存在することと、その要件が十分に検証されていることは同じではない**。とりわけ次の要件は、自動試験が担保する範囲が限定的である。

| 要件 | 限界 |
| --- | --- |
| FR-040、FR-041 | AnkiConnect の呼び出しを代替物に置き換えているため、実際の Anki における結果は担保しない |
| FR-011 | AI の応答を固定しているため、生成される内容の質は担保しない。構造の妥当性のみを確認する |
| FR-082 | 実際の配信は行わない。配信対象の選定と重複抑止のみを確認する |

## 7. 実施手段

### 7.1 ローカル

```bash
npm run lint          # 記述規約
npx tsc --noEmit      # 型検査
npm run verify        # 単体試験 + 検証仕様
npm run test:e2e      # E2E 試験 (開発サーバーを自動起動する)
npm run build         # 本番ビルド
```

開発中は `npm run verify:watch` を用いる。検証結果は `/verify` から一覧できる。

### 7.2 継続的インテグレーション

`.github/workflows/ci.yml` が `main` および `develop` への push と、すべての Pull Request で動作する。

| 段階 | 内容 |
| --- | --- |
| 1 | ESLint |
| 2 | TypeScript の型検査 |
| 3 | Vitest (単体試験 + 検証仕様) |

**E2E 試験は継続的インテグレーションに含まれていない。** 現状ではローカルでの実行に依存している。

<!-- TODO(user): E2E 試験を CI へ組み込むかを判断すること。組み込む場合、Firebase の資格情報を CI 上でどう扱うかの検討が必要である。 -->

## 8. 実施基準

| 場面 | 必須の試験 |
| --- | --- |
| Pull Request を作成する前 | 静的検査、単体試験、検証仕様、および変更範囲に対応する E2E 試験 |
| Pull Request のマージ | 継続的インテグレーションの全段階が成功していること |
| データ移行スクリプトの適用前 | 対応する単体試験、および dry-run による差分の確認 |
| Security Rules の変更 | 分離に関する単体試験、および反映前の内容確認 |
| リリース前 | 本番ビルドの成功、および第 2.2 節の手動確認項目 |

試験が失敗している状態で完了を報告してはならない。

## 9. 実装を変更した際の対応

| 変更内容 | 追加・更新する試験 |
| --- | --- |
| API ルートの追加・変更 | 対応する `verify/unit/` の試験 |
| コンポーネントの追加・変更 | 対応する `verify/specs/` の検証仕様 |
| 画面をまたぐ操作の変更 | 対応する `e2e/` の試験 |
| Firestore のスキーマ変更 | 移行スクリプトの試験、および分離に関する試験 |
| 機能要件の追加 | 本書のトレーサビリティマトリクスへの行の追加 |

機能要件を追加したにもかかわらず本書を更新しない場合、マトリクスは網羅を主張できなくなる。要件の追加と本書の更新は同一の Pull Request で行うこと。

## 改訂履歴

| 版数 | 日付 | 変更内容 | 変更者 |
| --- | --- | --- | --- |
| 1.0 | 2026-07-31 | 初版作成。試験の方針と種別を定義し、機能要件と試験ケースのトレーサビリティマトリクスを作成した | hong-quyen |
