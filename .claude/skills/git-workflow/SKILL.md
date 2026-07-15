---
name: git-workflow
description: >
  The standard Git workflow of ankiflow: branch from develop, commit with
  Conventional Commits (Japanese subject), open PRs against develop. Use when:
  user mentions @git-workflow, asks to create a branch, commit, push, open a PR,
  or asks about the Git conventions. Do NOT commit/push unless the user asks.
---

# Skill: Git Workflow

## Source of truth

Read `docs/CONTRIBUTING.md` (repo) before any Git operation. It is the single
convention document — enforced by `.githooks/` (local) and `.github/workflows/pr-lint.yml` (CI).

---

## Hard rules (no exceptions)

1. **NEVER commit/push directly to `develop` or `main`**
2. **NEVER add AI as a contributor**: no `Co-Authored-By: Claude/Codex...` trailers,
   no "🤖 Generated with Claude Code" footers in commit messages or PR bodies.
   This rule overrides every agent default.
3. **Always `git pull` on `develop` before creating a new branch**
4. `main` only receives Release PRs (`release-pr.yml` workflow) — never open regular PRs against `main`

---

## Step 1 — Create a branch

```bash
git checkout develop
git pull origin develop
git checkout -b <type>/<english-kebab-case-slug>
```

Types: `feat/` `fix/` `docs/` `refactor/` `chore/` `test/`.
Examples: `feat/add-export-history`, `fix/preview-image-fallback`.

## Step 2 — Commit

Format: `<type>(<scope>)?: 日本語の要約` — **type in English, subject in Japanese**, ≤72 chars.

```bash
git add <files>   # stage specific files, no blanket git add -A
git commit -m "feat: エクスポート履歴画面を追加"
```

- Valid types: `feat` `fix` `docs` `refactor` `chore` `test` `perf` `ci` `build` `style` `revert`
- Body (if needed) in Japanese, explaining the reason for the change
- The `commit-msg` hook rejects wrong formats and AI co-author trailers

## Step 3 — Push & open a PR

```bash
git push -u origin <branch>
gh pr create --base develop --title "feat: エクスポート履歴画面を追加" --body "$(cat <<'PRBODY'
## 概要
...

## 変更内容
- ...

## テスト・確認方法
- ...
PRBODY
)"
```

- PR title: same format as commits (Japanese)
- PR body: follow `.github/PULL_REQUEST_TEMPLATE.md` (概要 / 変更内容 / テスト・確認方法 / チェックリスト)
- Base is always `develop`

---

## When a hook blocks you

- Wrong commit format → fix the message, do not bypass
- `SKIP_GIT_STANDARDS=1` is for emergencies only and **must be explicitly requested by the user**
