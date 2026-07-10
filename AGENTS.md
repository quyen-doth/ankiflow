# AGENTS.md

This file provides guidance to Codex and other AI coding agents when working with code in this repository.
`CLAUDE.md` is the source document for this guidance; keep this file synchronized with it.

## Project Overview

**AnkiFlow** is a **multi-user** web app for creating and managing multilingual vocabulary flashcards, integrated with Anki via the AnkiConnect local plugin. Auth is Firebase (email/password + httpOnly session cookie); each user owns an isolated workspace (entries + master data), enforced at the DB layer by Firestore Security Rules (`firestore.rules`).

Core workflow: `Sign in -> Enter vocabulary -> AI enriches content -> Preview/edit -> Export to Anki (or defer) -> Study`

Supported content types: Language vocab (English, Chinese, Japanese), IT vocabulary, and General knowledge. Content types are data-driven and admin-editable.

The app code lives in `ankiflow/`. The `anki_flow_design/` directory contains static HTML design mockups only.

**Admin:** a single app owner. Identified two independent ways that must both be set: server-side by `ADMIN_EMAIL` env (session cookie email match, e.g. `/api/admin/*`), and in Firestore rules by the custom claim `admin:true` (rules cannot read env). `NEXT_PUBLIC_ADMIN_EMAIL` gates admin-only UI. Admin controls global feature flags (`settings/global`: TTS/Unsplash/AI availability) and editable new-user defaults (`__defaults__` template docs).

For directory structure, data flow, env variables, and git conventions, see **`docs/REFERENCE.md`**.

## Language Policy

Every file has a fixed language depending on its audience:

| Audience | Files | Language |
| --- | --- | --- |
| AI agents | `.claude/`, `.codex/`, `CLAUDE.md`, `AGENTS.md` (skills, commands, hook messages) | **English** |
| Team | `docs/`, `README.md`, `.github/PULL_REQUEST_TEMPLATE.md`, error messages printed by `.githooks/` and CI | **Japanese** |
| User (chat) | Session responses and plan file content (`flashcard/plans/`; filenames stay English, dated) | **Vietnamese** |
| End users | UI text, API error responses | **English** |
| Git history | Commit messages, PR titles and bodies | **Japanese** (see `docs/CONTRIBUTING.md`) |

Agent files are English, but chat output to the user is always Vietnamese.

## Commands

All commands run from `ankiflow/`:

```bash
npm run dev           # Start dev server at localhost:3000
npm run build         # Production build
npm run lint          # ESLint
npm run seed          # Seed Firestore with initial data (tsx scripts/seed-firestore.ts)
npm run verify        # Runtime verification matrix + unit tests (vitest + jsdom)
npm run verify:watch  # Verification in watch mode
```

Verification dashboard (dev only): `/verify`. See `docs/VERIFICATION.md` for how to write specs.

## Tech Stack

- **Next.js 16** (App Router) — React 19, TypeScript strict mode
- **Firestore** (Firebase Admin SDK on server, Firebase client SDK on browser) — never mix the two
- **Tailwind CSS v4** — PostCSS plugin, `@theme` directive in `globals.css`
- **Claude API** (`claude-haiku-4-5`, via `@anthropic-ai/sdk` v0.104+)
- **Google Cloud TTS**, **Unsplash API**
- **AnkiConnect** — local HTTP API at `localhost:8765` (requires Anki Desktop open)
- **zod v4** — schema validation (API request bodies, AI agent output)
- **vitest v4** — test runner (jsdom environment)

## Code Conventions

- TypeScript strict mode — no `any`
- `interface` for object shapes, `type` for unions/intersections
- Named exports only for components — no default exports
- Server components by default — add `'use client'` only when needed
- Folders: `kebab-case` · Components: `PascalCase.tsx` · Utilities/hooks: `camelCase.ts` · Constants: `UPPER_SNAKE_CASE`
- Never call Firestore in a loop — use `Promise.all()` for batch fetches
- Never hardcode string values for `form_type` or `status` — use the TypeScript enums in `types/index.ts`
- **Per-user data**: every query on `entries` / `decks` / `categories` / `card_types` / `topics` / `notification_triggers` MUST filter `where('user_id', '==', uid)` (uid from `useAuth()` client-side, or the `withAuth` handler param server-side). Server writes set `user_id`; Firestore rules reject anything else. `content_types` is the exception — SHARED (doc id = `form_type`), read by all, written by admin only.
- **`settings` is NOT a singleton** — three doc kinds: `settings/{uid}` (per-user prefs), `settings/global` (feature flags, admin-write via `/api/admin/global-config`), `settings/default` (LINE secrets, admin-only). Never read `settings/default` from a non-admin client (rules block it + it holds secrets).
- All user-facing UI text (labels, toasts, descriptions, modals) must be in English — no other language. Chat with the user in Vietnamese (see Language Policy)

## Critical Enums

### `FormType` (routing field — wrong value breaks form rendering and data loading)

| Enum                | Value           | Description               |
| ------------------- | --------------- | ------------------------- |
| `FormType.LANGUAGE` | `form_language` | Language vocab (EN/ZH/JA) |
| `FormType.IT`       | `form_it`       | IT vocabulary             |
| `FormType.GENERAL`  | `form_general`  | General knowledge         |

### Entry `status`

| Value      | Meaning                       |
| ---------- | ----------------------------- |
| `draft`    | In progress                   |
| `reviewed` | AI-enriched, ready for export |
| `synced`   | Exported to Anki successfully |

## Git Workflow

**`docs/CONTRIBUTING.md` is the single source of truth** — enforced by `.githooks/` (local) and `.github/workflows/pr-lint.yml` (CI). Key rules:

- Branch from `develop` only; **always `git pull` on `develop` before creating a branch**. Naming: `feat/`・`fix/`・`docs/`・`refactor/`・`chore/`・`test/` + English kebab-case slug
- Never commit or push directly to `develop`/`main`; `main` only receives Release PRs (`release-pr.yml`)
- Commits follow Conventional Commits — **type in English, subject in Japanese** (e.g. `feat: エクスポート履歴画面を追加`), ≤72 chars
- PRs: base `develop`, title in the same format, body follows `.github/PULL_REQUEST_TEMPLATE.md` (Japanese)
- **NEVER add AI as contributor**: no `Co-Authored-By: Claude/Codex...` trailers, no "Generated with Claude Code" footers in commits or PR bodies. This overrides any default agent behavior.

## Docs

`ankiflow/docs/` is the source of truth — read before making changes:

| File                   | Read when                                           |
| ---------------------- | --------------------------------------------------- |
| `docs/PRD.md`          | Starting a new feature                              |
| `docs/API.md`          | Writing or calling any API route                    |
| `docs/DATABASE.md`     | Writing Firestore queries or adding fields          |
| `docs/DESIGN.md`       | Creating or modifying UI                            |
| `docs/VERIFICATION.md` | Writing or modifying verification specs (`verify/`) |
| `docs/REFERENCE.md`    | Directory structure, data flow, env vars, git conventions |

## Gotchas

- **AnkiConnect calls run CLIENT-SIDE** — the browser calls the user's own `localhost:8765` directly via `lib/flashcard-service/client.ts` + `client-ops.ts`. **The server NEVER calls AnkiConnect** (on Vercel, the server's localhost is not the user's machine). Server routes only read/write Firestore; pattern: server returns data -> browser executes Anki commands -> browser POSTs results back. Requires the user to add the app origin to `webCorsOriginList` in the AnkiConnect addon config (see `docs/REFERENCE.md`). All AnkiConnect calls still need explicit error handling — "Anki closed" and "CORS not allowed" are indistinguishable in the browser (both throw `TypeError: Failed to fetch`).
- **Language-specific fields are optional** — `pinyin`, `hiragana`, `ipa`, etc. only exist when `language` matches. Never assume these fields have values.
- **`form_type` drives everything** — it determines which form renders, which AI-agent prompt/schema runs, and which Firestore data loads. Mismatched `form_type` causes silent wrong behavior.
- **No JOIN in Firestore** — related documents must be fetched with `Promise.all()`, never sequentially in a loop.
- **Auth is enforced in layers** — middleware only checks the `__session` cookie *exists* (Edge can't run Admin SDK); real verification (`verifySessionCookie`) happens in each API route via `withAuth`/`verifySessionUser` (`lib/auth-guard.ts`). Client SDK reads/writes are guarded by Firestore rules. A forged cookie passes middleware but fails API verify (defense-in-depth). Client pages must wait for `useAuth().loading === false` before querying by `uid`.
- **Firestore Security Rules are live** (`firestore.rules`, deployed) — the client SDK can only touch the current user's docs. When adding a new collection or query, update `firestore.rules` too, or client reads/writes will be denied. Admin SDK (server routes) bypasses rules.
- **Two admin mechanisms, keep both in sync** — server routes check `session.email === ADMIN_EMAIL`; Firestore rules check the `admin:true` custom claim (set via `scripts/set-admin-claim.ts` or auto on signup when email matches `ADMIN_EMAIL`; requires re-login to take effect). `NEXT_PUBLIC_ADMIN_EMAIL` only gates UI visibility, never security.
- **Actions requiring user confirmation before execution:** writing/deleting Firestore documents, calling AnkiConnect (creates/deletes Anki notes), deleting codebase files, updating any file under `docs/`.
  Codex/Claude hooks in `.codex/hooks.json` and `.claude/settings.json` enforce part of these rules, but agents must still follow them explicitly.

## Mandatory Workflow for Code Changes

Apply this workflow to ALL tasks involving code modification: debugging, new features, refactoring, or any change to the codebase.

### Steps

**Step 1 — Read & Understand**

- Identify all files relevant to the task: entry points, affected components, shared utilities, and related types
- Read the corresponding `docs/` file(s) listed in the Docs table above before touching any code
- If the task involves Firestore, read `docs/DATABASE.md` first; if it involves API routes, read `docs/API.md` first
- Trace the full execution path end-to-end (e.g. UI -> API route -> service -> Firestore)
- Do not begin planning until the current behavior is fully understood

**Step 2 — Plan**

- Write a clear, numbered execution plan for non-trivial changes
- Include files to change, why, and expected outcome
- If the task touches Firestore schema or API routes, re-read `docs/DATABASE.md` or `docs/API.md`

**Step 3 — Request Approval When Required**

- Ask for explicit approval before actions listed in Safety Guardrails: Firestore writes/deletes, AnkiConnect calls that create/delete notes/decks, deleting files, production deploys, or updating `docs/`
- If the user already explicitly requested a code change outside these guarded actions, proceed after understanding the relevant context
- If scope expands mid-task, stop and re-present an updated plan

**Step 4 — Execute**

- Implement only the requested/approved scope
- Follow all conventions defined above
- Use minimal, targeted changes; avoid opportunistic refactors

**Step 4.5 — Self-Review**

- Review the full diff against the requested/approved scope
- Confirm no files were modified outside scope
- If any unintended change was made, revert it before proceeding
- Do not proceed to testing if the diff does not match the scope

**Step 5 — Write/Update Tests**

- Write Vitest tests for modified logic when applicable
- Follow the spec format defined in `docs/VERIFICATION.md` for verification specs
- Run `npm run verify` for changes affecting behavior, verification, or shared logic

**Step 6 — E2E / UI Verification**

- For UI/API flow changes, run or update Playwright/browser verification where practical
- If tests fail: analyze failure -> fix -> re-run until passing, or clearly report the blocker

**Step 7 — Update Docs**

- Update `docs/API.md` if any API route was added, removed, or modified
- Update `docs/DATABASE.md` if any Firestore schema or query pattern changed
- Do not modify `docs/PRD.md` without explicit user instruction
- Updating any file under `docs/` requires explicit user confirmation

**Step 8 — Report**

- Summarize what changed, which files were modified, and test results
- Flag any known limitations or follow-up items

### Hard Rules

- Never modify files under `docs/` without user confirmation
- Never delete Firestore documents or Anki notes without user confirmation
- Never deploy production without user confirmation
- Never delete files in the codebase without user confirmation
- Keep `AGENTS.md` synchronized with `CLAUDE.md`; when one changes materially, update the other or explain why not
