---
description: Open a Pull Request against develop following docs/CONTRIBUTING.md (Japanese title/body, correct template)
---

Open a PR for the current branch following the conventions in `docs/CONTRIBUTING.md`:

1. Confirm the current branch is NOT `develop`/`main` and has commits; push with `git push -u origin <branch>` if not pushed yet
2. Review `git log develop..HEAD` to summarize all changes in the PR
3. Create the PR with `gh pr create --base develop`:
   - Title: format `<type>: 日本語の要約` (same as the commit convention)
   - Body: follow the structure of `.github/PULL_REQUEST_TEMPLATE.md` — fill in 概要 / 変更内容 / テスト・確認方法 / チェックリスト, written in Japanese
4. NEVER add "🤖 Generated with Claude Code" footers or any AI attribution to the body
5. Report back the URL of the created PR

Extra user arguments (if any): $ARGUMENTS
