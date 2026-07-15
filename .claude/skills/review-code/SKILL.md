---
name: review-code
description: >
  Review code changes in ankiflow against the project's own conventions plus
  correctness, security, and performance. Use when: user mentions @review-code,
  asks to review a diff, a branch, or a GitHub PR. Report-only — NEVER auto-fix,
  NEVER post to GitHub unless explicitly asked.
---

# Skill: Review Code

Shared by Claude Code and Codex (Codex: this file is referenced from `AGENTS.md`).
The built-in generic reviewers don't know this project's rules — this checklist is
the ankiflow-specific layer. Read the relevant `docs/` file before judging an area
(`docs/API.md`, `docs/DATABASE.md`, `docs/DESIGN.md`, `docs/CONTRIBUTING.md`).

---

## Step 1 — Collect the diff

**Mode A — local changes (default):**
```bash
git status
git diff develop...HEAD      # branch changes; use `git diff` / `--staged` for working tree
```

**Mode B — GitHub PR** (user gives a PR number/URL):
```bash
gh pr view <n>               # title, body, base
gh pr diff <n>
```

Read every changed file fully enough to understand context — never judge from the
diff hunk alone.

---

## Step 2 — Checklist

### Layer 1: ankiflow conventions (highest value — generic reviewers miss these)

- [ ] **Per-user isolation**: any query on `entries`/`decks`/`categories`/`card_types`/`topics`/`notification_triggers` without `where('user_id', '==', uid)`? Server writes missing `user_id: uid`? (`content_types` is the shared exception)
- [ ] **Enums**: hardcoded `'form_language'`/`'draft'`... instead of `FormType` / the status union from `types/index.ts`?
- [ ] **AnkiConnect in server code**: any AnkiConnect call inside `app/api/**` or server components — absolutely forbidden (client-side only, see `anki-connect` skill)
- [ ] **Firestore in a loop** instead of `Promise.all()`
- [ ] **New collection/query shape without touching `firestore.rules`** (client reads/writes will be denied) or missing index consideration
- [ ] **API conventions**: hand-rolled `NextResponse.json` instead of `apiSuccess`/`apiError`/`catchError`; missing `parseBody` + zod schema; wrong auth layer (`withAuth` vs `ADMIN_EMAIL` check vs `verifyStaticToken`) — see the `api` skill
- [ ] **SDK mixing**: Firebase Admin SDK and client SDK in the same module
- [ ] **UI conventions**: default exports; hardcoded colors/px instead of `@theme` tokens; new font-size token not registered in `lib/utils.ts` classGroups; UI text not in English; `'use client'` added without need
- [ ] **Docs sync**: API/schema/design change without a proposal to update `docs/API.md` / `docs/DATABASE.md` / `docs/DESIGN.md`
- [ ] **Git hygiene** (Mode B): commit messages violate `docs/CONTRIBUTING.md` format; AI co-author/footer present

### Layer 2: correctness

- [ ] Logic errors, unhandled edge cases (empty arrays, missing optional language fields like `pinyin`/`hiragana`)
- [ ] Null/undefined safety; unawaited promises; race conditions (e.g. client queries before `useAuth().loading === false`)
- [ ] Error handling: AnkiConnect calls without try/catch; `{ result, error }` responses where `error` is unchecked

### Layer 3: security

- [ ] Secrets in code or logs; `.env` values echoed anywhere
- [ ] Missing auth on a new route; admin action gated only by `NEXT_PUBLIC_ADMIN_EMAIL` (UI-only — never security)
- [ ] Client reading `settings/default` (admin secrets) or another user's docs
- [ ] Unvalidated user input reaching Firestore/external APIs

### Layer 4: performance & simplification

- [ ] Reinvented helpers (`lib/api-response.ts`, `lib/firestore-helpers.ts`, `client-ops.ts`, `cn()`...) — reuse instead
- [ ] Unnecessary re-renders, duplicate fetches, missing batch fetch
- [ ] Dead code, leftover `console.log`, over-abstraction for a single call site

---

## Step 3 — Report (in Vietnamese, in chat)

Severity levels:

| Level | Meaning |
| --- | --- |
| 🔴 Critical | Bug, security hole, data leak, broken build — must fix before merge |
| 🟡 Warning | Convention violation — should fix |
| 🔵 Suggestion | Performance / simplification — optional |

Format for each finding: `file:line` + severity + one-sentence problem + concrete fix
suggestion. End with an overall verdict (mergeable or not, and what blocks it).
If nothing is found in a layer, say so explicitly — do not invent findings.

---

## Step 4 — Posting to GitHub (ONLY when the user explicitly asks)

- Post in **Japanese** (Language Policy: GitHub is team-facing):
  `gh pr comment <n> --body "..."` for an overall review, or `gh pr review <n> --comment/--request-changes`
- Never include AI attribution in posted comments

---

## Hard rules

- **Report-only**: NEVER modify code during a review — list findings and wait for the user's decision
- **NEVER post to GitHub without an explicit request** in this conversation
- Verify each finding against the actual code before reporting (no guesses from diff context alone)
- Findings must be ranked most-severe first
