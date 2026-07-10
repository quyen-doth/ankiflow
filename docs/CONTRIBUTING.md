# コントリビューションガイド

本リポジトリの Git 運用ルール。人間・AI エージェント (Claude Code / Codex) 共通のルールであり、`.githooks/`(ローカル)と `.github/workflows/pr-lint.yml`(CI)で強制される。

## 基本方針

- **`develop`** = 日常の作業のベースブランチ(デフォルトブランチ)
- **`main`** = リリース専用。`release-pr.yml` が生成する Release PR のマージでのみ更新する
- `develop` / `main` への**直接コミット・直接プッシュは禁止**(git hooks でブロック)

## ブランチ運用

1. 必ず `develop` から作成する
2. **作成前に必ず `git pull` を実行**して最新化する:

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feat/add-export-history
   ```

3. 命名規則: `<type>/<slug>` — slug は**英語の kebab-case**

   | プレフィックス | 用途 |
   | --- | --- |
   | `feat/` | 新機能 |
   | `fix/` | バグ修正 |
   | `docs/` | ドキュメントのみ |
   | `refactor/` | 挙動を変えないリファクタリング |
   | `chore/` | 設定・ビルド・依存関係 |
   | `test/` | テストのみ |

## コミット規約

[Conventional Commits](https://www.conventionalcommits.org/) 形式。**type は英語、要約は日本語**で書く。

```
<type>(<scope>)?: 日本語の要約(72文字以内)

(任意)本文 — 変更の理由・背景を日本語で
```

- type: `feat` `fix` `docs` `refactor` `chore` `test` `perf` `ci` `build` `style` `revert`
- scope は任意(英語 kebab-case)。例: `feat(preview): カード編集モーダルを追加`
- 例: `fix: リリースPRワークフローの権限エラーを修正`

## AI エージェントに関する規則

- Claude Code / Codex などの AI エージェントは、**自分自身をコントリビューターとして追加してはならない**
  - コミットメッセージに `Co-Authored-By: Claude ...` / `Co-Authored-By: Codex ...` 等のトレーラーを付けない
  - コミットメッセージ・PR 本文に「🤖 Generated with Claude Code」等のフッターを付けない
- 作者はユーザー本人のみ。この規則は commit-msg フックと CI の両方でブロックされる

## PR 規約

- タイトル: コミットと同じ形式(`type: 日本語の要約`)
- base ブランチ: **`develop`**(リリース PR のみ `main`)
- 本文: `.github/PULL_REQUEST_TEMPLATE.md` に従う
- マージ方法: **merge commit**(現行運用を踏襲)

```bash
git push -u origin feat/add-export-history
gh pr create --base develop --title "feat: エクスポート履歴画面を追加"
```

## 強制レイヤー

| レイヤー | 仕組み | 内容 |
| --- | --- | --- |
| ローカル | `.githooks/`(`npm install` 時に `prepare` スクリプトが `core.hooksPath` を設定) | commit-msg 形式検証・AI co-author ブロック・保護ブランチへの commit/push ブロック |
| CI | `.github/workflows/pr-lint.yml` | PR タイトル・全コミットメッセージ・PR 本文を検証 |
| ガイド | 本ファイル + `CLAUDE.md` / `AGENTS.md` + `.claude/skills/git-workflow/` | エージェントへの指示 |

緊急時のバイパス(原則使用禁止): `SKIP_GIT_STANDARDS=1 git commit ...`

## セットアップ(clone 直後)

```bash
npm install   # prepare スクリプトが git config core.hooksPath .githooks を実行
```
