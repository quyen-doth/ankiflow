# 運用手順書 — AnkiFlow

| 項目 | 内容 |
| --- | --- |
| 文書ID | AF-OPS-001 |
| 版数 | 1.1 |
| 作成日 | 2026-08-01 |
| 最終更新日 | 2026-08-02 |
| 作成者 | [hong-quyen](https://github.com/quyen-doth) |
| ステータス | 運用中 |
| 関連文書 | AF-SET-001、AF-DEV-001、AF-SEC-001、AF-NFR-001 |

## 1. 本書の位置づけ

本書は、AnkiFlow の本番環境における運用手順を定義する。対象は、リリース、デプロイ、初期データおよび権限の管理、定期実行、監視、障害対応、および切り戻しである。

ローカル環境の構築手順は環境構築手順書 (AF-SET-001) に定める。バージョン付与の規則そのものは開発規約 (AF-DEV-001) に定める。本書はそれらを前提に、**実際に手を動かす順序**を扱う。

## 2. 構成

| 要素 | 内容 |
| --- | --- |
| ホスティング | Vercel |
| データベース | Firebase Firestore |
| 認証基盤 | Firebase Authentication |
| 定期実行 | GitHub Actions (`.github/workflows/srs-push.yml`) |
| 継続的インテグレーション | GitHub Actions (`.github/workflows/ci.yml`) |
| リリース自動化 | GitHub Actions (`release-pr.yml`、`release-tag.yml`) |

`main` ブランチが本番に対応する。`develop` は日常の作業のベースであり、`main` はリリース専用である。

## 3. リリース

### 3.1 流れ

```
develop へ push
   └─▶ release-pr.yml
         ├─ scripts/prepare-release.mjs
         │    ├─ 前回の準備を取り消す
         │    ├─ main...develop の全コミットからバージョンを再算出する
         │    └─ package.json / package-lock.json / CHANGELOG.md を書き換える
         ├─ 差分があれば develop へコミットする
         └─ Release PR を作成または更新する (タイトル: release: vX.Y.Z)
                └─▶ Release PR をマージ
                      └─▶ release-tag.yml
                            ├─ タグ vX.Y.Z を作成して push する
                            └─ GitHub Release を作成する
```

### 3.2 手順

| # | 実施すること |
| --- | --- |
| 1 | `develop` の継続的インテグレーションが成功していることを確認する |
| 2 | 自動生成された Release PR の内容を確認する。とりわけ算出されたバージョンと `CHANGELOG.md` の記載を見る |
| 3 | 第 9 章の事前確認を実施する |
| 4 | Release PR をマージする |
| 5 | タグと GitHub Release が生成されたことを確認する |
| 6 | Vercel のデプロイが成功したことを確認する |
| 7 | 本番環境で第 6 章の確認を行う |

### 3.3 注意事項

- `package.json` および `package-lock.json` の `version` を手で編集してはならない。ワークフローが管理する。
- Release PR を開いたまま `develop` が進んだ場合、バージョンは自動的に再算出される。`fix` のみの状態で準備されたあとに `feat` がマージされれば、バージョンは繰り上がる。
- `release-tag.yml` を再実行した場合は、タグと GitHub Release のうち不足している成果物だけを作成する。両方が存在すれば何もしない。
- `main` 以外からの手動実行、対象バージョンのリリースノート欠落、または同名タグが現在の `main` 以外を指す場合は、誤ったリリースを作成せず明示的に失敗する。
- 自動生成される Release PR は Pull Request の検査対象外である。個々の Pull Request で検査済みであるためである。
- `release-pr.yml` は `develop` へ直接 push する。`develop` のブランチ保護は `github-actions[bot]` の push を許可する設定でなければならない。

## 4. デプロイ

### 4.1 アプリケーション

Vercel が `main` への push を検知して自動的にデプロイする。手動の操作を要しない。

環境変数は Vercel のプロジェクト設定に登録する。一覧は環境構築手順書 (AF-SET-001) 第 4 章と同一である。

`GOOGLE_TTS_CREDENTIALS_JSON` は本番で必須である。`GOOGLE_APPLICATION_CREDENTIALS` はファイルパスを指すため、ファイルが存在しないサーバーレス環境では使用できない。

環境変数を変更した場合は再デプロイが必要である。`SIGNUP_ENABLED` の切り替えも同様であり、コードの変更は要しない。

### 4.2 Firestore Security Rules とインデックス

アプリケーションのデプロイとは独立している。自動的には反映されない。

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

Security Rules はクライアントアクセスの唯一の拠り所である。誤った内容を反映すると、全利用者のクライアント側の読み書きが停止する。

| # | 手順 |
| --- | --- |
| 1 | 変更内容を確認する |
| 2 | 明示的な承認を得る |
| 3 | 反映する |
| 4 | 実際にログインし、一覧の表示と作成が行えることを確認する |

規則を伴う機能を追加する場合、**アプリケーションより先に規則を反映する**。順序を誤ると、新しいコードが到達したときに規則が拒否する。

インデックスの作成には時間を要する。作成中の問い合わせは失敗するため、反映の完了を Firebase コンソールで確認してから利用する。

## 5. 定期実行

### 5.1 復習通知

`.github/workflows/srs-push.yml` が毎時 3 回 (7 分、27 分、47 分) に `GET /api/cron/srs-push` を呼び出す。0 分を避けているのは、GitHub Actions において当該時刻の遅延と欠落が起きやすいためである。

必要なリポジトリシークレットは `APP_URL` と `CRON_SECRET` である。`CRON_SECRET` はアプリケーション側の環境変数と同じ値でなければならない。

実行が欠落した場合、API 側が直前の時間帯を補完する。同一利用者の同一時刻に対する再送は抑止される。したがって、1 回程度の欠落は運用上の対処を要しない。

手動実行は GitHub Actions の画面から行える。

## 6. デプロイ後の確認

| # | 確認内容 |
| --- | --- |
| 1 | ログインできること |
| 2 | ダッシュボードに統計が表示されること |
| 3 | 履歴の一覧が表示されること (Firestore の読み取りと規則の確認を兼ねる) |
| 4 | カードを 1 件生成できること (AI、画像、音声の確認を兼ねる) |
| 5 | 生成した内容を保存できること (書き込みの確認を兼ねる) |
| 6 | 管理者の場合、全体設定を開けること |

第 4 項は外部 API を消費する。頻繁に実施する必要はない。

## 7. 運用作業

### 7.1 初期データの投入

```bash
npm run seed                # content_types、settings/global、settings/default
npm run seed -- --defaults  # __defaults__ テンプレートを公開する
```

初回構築時に実施する。`--defaults` を省略した場合も、サインアップ時に必要に応じて公開される。

### 7.2 管理者権限の付与

```bash
npx tsx scripts/set-admin-claim.ts <email>
```

環境変数 `ADMIN_EMAIL` の設定とあわせて、**両方**を行う必要がある。詳細はセキュリティ設計書 (AF-SEC-001) 第 6 章に定める。

付与後、対象の利用者は**再ログインしなければ権限が反映されない**。カスタムクレームは ID トークンに埋め込まれるためである。

### 7.3 利用者の追加

公開サインアップを有効にせずに利用者を追加する場合に用いる。

```bash
npm run user:create -- <email>
```

パスワードは対話形式で入力する。実行確認のうえ Firebase Authentication に利用者を作成し、初期マスターデータを投入する。メールアドレスが `ADMIN_EMAIL` と一致する場合は管理者クレームも付与する。`SIGNUP_ENABLED` の値には依存しない。

クレームまたは初期データの投入に失敗した場合、作成済みの UID と復旧手順を表示して異常終了する。利用者は自動削除されない。表示された手順に従って復旧すること。

### 7.4 データ移行

移行スクリプトはすべて **dry-run が既定**である。

| # | 手順 |
| --- | --- |
| 1 | 引数なしで実行し、対象と差分を確認する |
| 2 | 出力の全件を確認する |
| 3 | Firestore への書き込みについて明示的な承認を得る |
| 4 | `--apply` を付けて実行する |
| 5 | 再度 dry-run を実行し、対象が 0 件であることを確認する |

```bash
npm run migrate:user-content-types              # 不足している Content Type snapshot を作成する
npm run migrate:ai-output-profiles              # 未設定の AI 出力プロファイルを補う
npm run migrate:content-type-english            # 旧既定の表示文字列を英語へ更新する
npm run migrate:output-language-controls        # 不足している出力言語 control を補う
npm run migrate:entry-query-fields              # 問い合わせ用の派生フィールドを補う
npx tsx scripts/sync-admin-defaults.ts          # 管理者 workspace を __defaults__ へ反映する
```

いずれも作成または統合のみを行い、利用者の設定を上書きしない。ただし `sync-admin-defaults.ts` は既存テンプレートの削除を伴う。既存のテンプレートを空にする差分は `--apply` だけでは拒否され、意図的な場合に限り `--allow-empty` を併用する。

`migrate:output-language-controls` は機能導入時の一度限りの移行である。利用者が意図して control を削除したあとに再実行してはならない。

### 7.5 費用の発生する機能の停止

想定を超える利用や費用が発生した場合、管理者は全体設定 (`/settings/admin`) から AI、音声、画像の各機能を無効化できる。設定は全利用者へ即座に適用される。

環境変数の変更や再デプロイを要しない。緊急時の第一手段として用いる。

## 8. 監視

現時点で専用の監視基盤を持たない。確認は次の手段による。

| 対象 | 手段 |
| --- | --- |
| アプリケーションの稼働 | Vercel のダッシュボードとログ |
| Firestore の使用量 | Firebase コンソール |
| Claude API の費用 | Anthropic Console |
| 定期実行の成否 | GitHub Actions の実行履歴 |
| 継続的インテグレーション | GitHub Actions の実行履歴 |

障害を自動で検知する仕組みはない。利用者からの申告、または定期的な確認によって把握する。

<!-- TODO(user): 定期実行の失敗を通知する仕組みを設けるかを判断すること。現状では GitHub Actions の失敗に気づく手段がない。 -->

## 9. 事前確認

リリース前に確認する項目を示す。

| # | 項目 |
| --- | --- |
| 1 | 継続的インテグレーションが成功していること |
| 2 | 本番ビルドが成功すること |
| 3 | Firestore のスキーマを変更した場合、移行スクリプトを用意し、dry-run を確認済みであること |
| 4 | Security Rules を変更した場合、反映の順序を決めていること |
| 5 | 環境変数を追加した場合、Vercel と `.env.example` の双方へ反映済みであること |
| 6 | API を変更した場合、AF-API-001 を更新済みであること |
| 7 | スキーマを変更した場合、AF-DB-001 を更新済みであること |
| 8 | 画面を追加または削除した場合、AF-SCR-001 を更新済みであること |
| 9 | `CHANGELOG.md` の `[Unreleased]` に利用者影響のある変更を記載済みであること |

## 10. 障害対応

### 10.1 切り分け

| 事象 | 最初に確認すること |
| --- | --- |
| 画面が開かない | Vercel のデプロイ状態とログ |
| ログインできない | Firebase Authentication の状態、`FIREBASE_ADMIN_*` の設定 |
| 一覧が空になる、権限エラーが出る | Firestore Security Rules の反映内容 |
| 特定の一覧だけが失敗する | 複合インデックスの有無と作成状態 |
| AI 生成が失敗する | `ANTHROPIC_API_KEY`、Anthropic 側の状態、全体設定の機能フラグ |
| 音声が生成されない | `GOOGLE_TTS_CREDENTIALS_JSON` の設定、全体設定の機能フラグ |
| 通知が届かない | GitHub Actions の実行履歴、`CRON_SECRET` の一致、利用者の LINE 連携状態 |
| Anki へ登録できない | 利用者環境の問題である可能性が高い。第 10.2 節を参照する |

### 10.2 Anki 連携の失敗

ブラウザが返す `TypeError: Failed to fetch` は、次の 3 つを区別できない。ブラウザが詳細を JavaScript へ開示しないためである。

| 原因 | 対処 |
| --- | --- |
| Anki Desktop が起動していない | 起動する |
| `webCorsOriginList` にオリジンが未登録である | 登録して Anki を再起動する |
| ブラウザのローカルネットワークアクセス制限 | `http://localhost:3000` から利用するか、ブラウザ側で当該サイトへ許可を与える |

Safari は HTTPS のページから `localhost` への接続を許可しない。他のブラウザを案内する。

いずれもアプリケーション側の障害ではない。サーバーの修正では解決しない。

### 10.3 対応後

原因と対処を記録する。恒常的な対策が必要な場合はロードマップ (AF-RDM-001) へ反映する。

## 11. 切り戻し

### 11.1 アプリケーション

Vercel のダッシュボードから直前のデプロイへ差し戻す。最も早く、影響範囲が明確である。

コードとして戻す場合は、`main` に対する打ち消しコミットを作成し、通常のリリース手順に乗せる。`main` への直接 push は禁止されている。

### 11.2 Security Rules

規則には版管理の仕組みがない。リポジトリ上の以前の内容を復元して再度反映する。

```bash
git show <前のコミット>:firestore.rules > firestore.rules
firebase deploy --only firestore:rules
```

### 11.3 データ

**Firestore のデータに切り戻し手段はない。** 移行スクリプトが誤った変更を加えた場合、自動的に復旧する手段は存在しない。

このため、移行は次の性質を保っている。

| 性質 | 内容 |
| --- | --- |
| dry-run が既定 | 適用は明示的な指定を要する |
| 作成または統合のみ | 既存の値を上書きしない |
| 適用時の再確認 | トランザクション内で対象条件を再度確かめる |

これらは復旧手段の代替ではなく、**誤りを起こさないための予防**である。適用前の確認を省略してはならない。

<!-- TODO(user): Firestore の定期バックアップを設定するかを判断すること。現状ではデータの復旧手段が存在しない。 -->

## 改訂履歴

| 版数 | 日付 | 変更内容 | 変更者 |
| --- | --- | --- | --- |
| 1.1 | 2026-08-02 | リリース再実行時の不足成果物のみを補う挙動と fail-closed 条件を追記し、削除済みの旧 LINE 実行経路を除去 | hong-quyen |
| 1.0 | 2026-08-01 | 初版作成。リリース、デプロイ、定期実行、運用作業、障害対応、切り戻しの各手順を定義した | hong-quyen |
