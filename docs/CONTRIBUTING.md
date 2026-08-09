# 開発規約 — AnkiFlow

| 項目 | 内容 |
| --- | --- |
| 文書ID | AF-DEV-001 |
| 版数 | 1.5 |
| 作成日 | 2026-07-10 |
| 最終更新日 | 2026-08-09 |
| 作成者 | [hong-quyen](https://github.com/quyen-doth) |
| ステータス | 運用中 |
| 関連文書 | AF-IDX-001、AF-OPS-001 |

本リポジトリの Git 運用ルール。人間・AI エージェント (Claude Code / Codex) 共通のルールであり、`.githooks/`(ローカル)と `.github/workflows/pr-lint.yml`(CI)で強制される。

## 基本方針

- `develop` = 日常の作業のベースブランチ(デフォルトブランチ)
- `main` = 本番専用。`release-pr.yml` が生成する Release PR または同期 PR のマージでのみ更新する
- `develop` / `main` への直接コミット・直接プッシュは禁止(git hooks でブロック)

## ブランチ運用

1. 必ず `develop` から作成する
2. 作成前に必ず `git pull` を実行して最新化する:

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feat/add-export-history
   ```

3. 命名規則: `<type>/<slug>` — slug は英語の kebab-case

   | プレフィックス | 用途 |
   | --- | --- |
   | `feat/` | 新機能 |
   | `fix/` | バグ修正 |
   | `docs/` | ドキュメントのみ |
   | `refactor/` | 挙動を変えないリファクタリング |
   | `chore/` | 設定・ビルド・依存関係 |
   | `test/` | テストのみ |

## コミット規約

[Conventional Commits](https://www.conventionalcommits.org/) 形式。type は英語、要約は日本語で書く。

```
<type>(<scope>)?: 日本語の要約(72文字以内)

(任意)本文 — 変更の理由・背景を日本語で
```

- type: `feat` `fix` `docs` `refactor` `chore` `test` `perf` `ci` `build` `style` `revert`
- scope は任意(英語 kebab-case)。例: `feat(preview): カード編集モーダルを追加`
- 例: `fix: リリースPRワークフローの権限エラーを修正`

## AI エージェントに関する規則

- Claude Code / Codex などの AI エージェントは、自分自身をコントリビューターとして追加してはならない
  - コミットメッセージに `Co-Authored-By: Claude ...` / `Co-Authored-By: Codex ...` 等のトレーラーを付けない
  - コミットメッセージ・PR 本文に「🤖 Generated with Claude Code」等のフッターを付けない
- 作者はユーザー本人のみ。この規則は commit-msg フックと CI の両方でブロックされる

## PR 規約

- タイトル: コミットと同じ形式(`type: 日本語の要約`)
- base ブランチ: `develop`(自動生成される Release PR / 同期 PR のみ `main`)
- 本文: `.github/PULL_REQUEST_TEMPLATE.md` に従う
- マージ方法: merge commit(現行運用を踏襲)

```bash
git push -u origin feat/add-export-history
gh pr create --base develop --title "feat: エクスポート履歴画面を追加"
```

## バージョニング規則

バージョン番号は [セマンティック バージョニング](https://semver.org/lang/ja/) に従い、`develop` から `main` へのリリースごとに 1 つ繰り上げる。

### 繰り上げの判定

判定は、リリース対象コミット (`main...develop`) の Conventional Commits の type から機械的に導出する。判定を人が行うことはない。繰り上げの基点となる「前回リリースのバージョン」は、`main` の `package.json` と `main` から到達できる最新タグのうち、大きいほうを採用する。

| リリース対象に含まれるコミット | 繰り上げ |
| --- | --- |
| `feat:` / 任意の type の `!:` / 本文に `BREAKING CHANGE` フッター | MINOR (0.x の間) / MAJOR (1.0.0 以降) |
| `docs:` `test:` `ci:` のみ | 繰り上げない (同期 PR を作成する) |
| 上記以外の type (`fix` `refactor` `perf` `chore` `style` `build` `revert`) | PATCH |

`docs:` `test:` `ci:` は本ガイド「開発者が行うこと」により `CHANGELOG.md` に記載しない種類である。したがってこれらだけを含む範囲では版を繰り上げず、`release: developをmainへ同期` という同期 PR を作成する。同期 PR は差分を `main` へ反映するが、本文の空いた版、タグ、および GitHub Release は作成しない。

ただし**破壊的変更は type を問わず繰り上げの対象**である。`docs!:` も、本文に `BREAKING CHANGE` フッターを持つ `docs:` も、通常どおりリリースされる。

なお、版を繰り上げるコミットが存在する一方で `[Unreleased]` が空の場合、`prepare-release.mjs` はファイルを書き換えずに中断する。利用者に影響のある変更であれば `[Unreleased]` へ追記すること。文書・テスト・CI 設定のみで版を繰り上げない場合は、空の `[Unreleased]` を許容して同期 PR を作成する。

現在は `0.x` であり、SemVer 第 4 項のとおり公開 API の安定性を約束していない。したがって破壊的変更も MINOR として扱うが、その場合は `CHANGELOG.md` に「破壊的変更」の見出しを設けて明記すること。

`1.0.0` への移行条件: 実際の利用を通じてデータモデル (コンテンツタイプ、カードタイプ、AI 出力プロファイル、および Anki ノートタイプのフィールド構成) が安定し、移行スクリプトを要する変更が発生しなくなったと判断した時点とする。利用者数や公開サインアップの有無は判断材料としない。それらは事業上の節目であり、互換性の事象ではないためである。

`1.0.0` へ移行する際は、本ガイドに「公開 API の定義」を追記し、互換性を保証する対象を明示すること。定義のない `1.0.0` は意味を持たない。

### リリースの流れ

```
develop へ push
   └─▶ release-pr.yml
         ├─ scripts/prepare-release.mjs
         │    ├─ 前回の準備を取り消す (準備済み節を [Unreleased] へ戻す)
         │    ├─ main...develop の全コミットからバージョンを再算出
         │    └─ 版を繰り上げる場合のみ package.json / package-lock.json / CHANGELOG を書き換える
         ├─ リリース準備の差分があれば develop へコミット (chore: リリース vX.Y.Z の準備)
         └─ 自動生成 PR を作成 / 更新
                ├─ Release PR: release: vX.Y.Z
                ├─ 同期 PR: release: developをmainへ同期 (版は変更しない)
                └─▶ 自動生成 PR をマージ
                      └─▶ release-tag.yml
                            ├─ 版を繰り上げた場合: タグと GitHub Release を作成
                            └─ 版を変更していない場合: 既存の成果物を保持
```

### 自動生成 PR が未マージのまま develop が進んだ場合

`prepare-release.mjs` は冪等であるだけでなく、再入可能である。Release PR を開いたまま `develop` に新しいコミットがマージされた場合、次の実行で以下が起こる。

1. 前回準備した節 (`## [X.Y.Z]`) の内容を `[Unreleased]` へ戻し、`package.json` を前回リリースのバージョンへ戻す
2. `main...develop` の全コミットを対象にバージョンを算出し直す
3. 算出したバージョンで改めて準備する

したがって、`fix` だけの状態で `v0.13.2` として準備されたあとに `feat` がマージされれば、バージョンは自動的に `v0.14.0` へ繰り上がり、CHANGELOG の記載も同じ節へ統合される。バージョンは常に、そのリリースに含まれる全コミットを反映する。

なお、算出の基点は常に `main` 側の情報であり、既に繰り上げ済みの `develop` の `package.json` を基点にすることはない。基点を作業ブランチに置くと、上記の再算出ができなくなるためである。

自身が生成したコミット (`chore: リリース vX.Y.Z の準備`) は、バージョン判定の対象から除外される。

文書・テスト・CI 設定のみの状態で同期 PR が開かれたあとに `fix:` や `feat:` が追加された場合、同じ PR を Release PR へ更新し、算出した版と本文を差し替える。別の `develop` → `main` PR は作成しない。

### タグと GitHub Release の再実行

`release-tag.yml` は `main` の同じバージョンに対して再実行できる。タグと GitHub Release の状態を個別に確認し、不足している成果物だけを作成する。同期 PR のマージ後は、同名タグが現在の `main` の祖先を指していれば既存のリリース成果物として扱う。両方が存在する場合は何も変更しない。

次の場合は誤った成果物を作成せず、理由を表示して失敗する。

- `main` 以外の ref から手動実行した場合
- `CHANGELOG.md` に対象バージョンのリリースノートがない場合
- 同名タグが現在の `main` と無関係なコミット (祖先ではないコミット) を指す場合

### 開発者が行うこと

- 利用者に影響のある変更を加えた場合、`CHANGELOG.md` の `[Unreleased]` に追記する。追加は「追加」、変更は「変更」、修正は「修正」の見出しに分類する。
- `[Unreleased]` には見出し (`### `) と箇条書きのみを記載する。スクリプトが節を統合する際に整形するため、コードブロックや表は保持されない。
- `package.json` および `package-lock.json` の `version` を手で編集してはならない。ワークフローが管理する。
- 文書・テスト・CI 設定のみの変更は `CHANGELOG.md` に記載しない。

### 前提条件

`release-pr.yml` は `develop` へ直接 push する。したがって `develop` のブランチ保護は、`github-actions[bot]` による push を許可する設定である必要がある。

## 強制レイヤー

| レイヤー | 仕組み | 内容 |
| --- | --- | --- |
| ローカル | `.githooks/`(`npm install` 時に `prepare` スクリプトが `core.hooksPath` を設定) | commit-msg 形式検証・AI co-author ブロック・保護ブランチへの commit/push ブロック |
| CI | `.github/workflows/pr-lint.yml` | PR タイトル・全コミットメッセージ・PR 本文を検証。`release-pr.yml` が自動生成する Release PR / 同期 PR (`develop` → `main`) は対象外(中身は各 feature PR で検証済みのため) |
| ガイド | 本ファイル + `CLAUDE.md` / `AGENTS.md` + `.claude/skills/git-workflow/` | エージェントへの指示 |

緊急時のバイパス(原則使用禁止): `SKIP_GIT_STANDARDS=1 git commit ...`

## セットアップ(clone 直後)

```bash
npm install   # prepare スクリプトが git config core.hooksPath .githooks を実行
```

## 改訂履歴

| 版数 | 日付 | 変更内容 | 変更者 |
| --- | --- | --- | --- |
| 1.5 | 2026-08-09 | 文書・テスト・CI のみの差分でも同期 PR を作成し、版・タグ・GitHub Releaseを変更せず `main` へ反映する運用を追記 | hong-quyen |
| 1.4 | 2026-08-02 | 文書・テスト・CI のみの変更は繰り上げずリリース PR も作成しないこと、破壊的変更は type を問わず繰り上げの対象であること、`[Unreleased]` が空の場合は準備を中断することを追記 | hong-quyen |
| 1.3 | 2026-08-02 | タグと GitHub Release の再実行時に不足分だけを補い、不正な ref・タグ・リリースノートを fail-closed で拒否する挙動を追記 | hong-quyen |
| 1.2 | 2026-08-01 | 文書管理情報と改訂履歴を追加 | hong-quyen |
| 1.1 | 2026-07-31 | バージョニング規則の章を追加 | hong-quyen |
| 1.0 | 2026-07-10 | 初版作成 | hong-quyen |
