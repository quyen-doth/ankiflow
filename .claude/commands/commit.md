---
description: Commit current changes following docs/CONTRIBUTING.md (Conventional Commits, Japanese subject)
---

Commit the current changes following the conventions in `docs/CONTRIBUTING.md`:

1. Run `git status` and `git diff` to understand all changes
2. If currently on `develop` or `main`: STOP — inform the user and offer to create a new branch from `develop` (remember to `git pull` first)
3. Group the changes sensibly (multiple commits if the changes belong to different types)
4. Stage specific relevant files (no `git add -A` when unrelated files are present)
5. Commit with the format `<type>(<scope>)?: 日本語の要約` (≤72 chars, type in English, subject in Japanese)
6. NEVER add `Co-Authored-By` trailers or "Generated with Claude Code" footers
7. Report back: hash + message of each commit

Extra user arguments (if any): $ARGUMENTS
