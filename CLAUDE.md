# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AnkiFlow** is a web app for creating and managing multilingual vocabulary flashcards, integrated directly with Anki via the AnkiConnect local plugin.

Core workflow: `Enter vocabulary → AI enriches content → Preview/edit → Export to Anki → Study`

Supported content types: Language vocab (English, Chinese, Japanese) and IT vocabulary.

The app code lives in `ankiflow/`. The `anki_flow_design/` directory contains static HTML design mockups only.

For directory structure, data flow, env variables, and git conventions, see **`docs/REFERENCE.md`**.

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
- `settings` is a singleton document — never create a new one, only update the existing one

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

## Docs

`ankiflow/docs/` is the source of truth — read before making changes:

| File                   | Read when                                                 |
| ---------------------- | --------------------------------------------------------- |
| `docs/PRD.md`          | Starting a new feature                                    |
| `docs/API.md`          | Writing or calling any API route                          |
| `docs/DATABASE.md`     | Writing Firestore queries or adding fields                |
| `docs/DESIGN.md`       | Creating or modifying UI                                  |
| `docs/VERIFICATION.md` | Writing or modifying verification specs (`verify/`)       |
| `docs/REFERENCE.md`    | Directory structure, data flow, env vars, git conventions |

## Gotchas

- **AnkiConnect is local** — only works when Anki Desktop is open. All AnkiConnect calls need explicit error handling for the disconnected case.
- **Language-specific fields are optional** — `pinyin`, `hiragana`, `ipa`, etc. only exist when `language` matches. Never assume these fields have values.
- **`form_type` drives everything** — it determines which form renders, which AI-agent prompt/schema runs, and which Firestore data loads. Mismatched `form_type` causes silent wrong behavior.
- **No JOIN in Firestore** — related documents must be fetched with `Promise.all()`, never sequentially in a loop.
- **Actions requiring user confirmation before execution:** writing/deleting Firestore documents, calling AnkiConnect (creates/deletes Anki notes), deleting codebase files, updating any file under `docs/`.
    > Enforced by `PreToolUse` hooks in `.claude/settings.json` for Firestore deletes, AnkiConnect deletes, and `docs/` edits — these are blocked automatically, not just by convention.

## Mandatory Workflow for Code Changes

> Apply this workflow to ALL tasks involving code modification: debugging, new features, refactoring, or any change to the codebase.

### Steps (must follow in order — do not skip)

**Step 1 — Read & Understand**

- Read all files relevant to the task
- Read the corresponding `docs/` file(s) listed in the Docs table above
- Fully understand the current behavior before planning anything

**Step 2 — Plan**

- Turn on plan mode
- Write a clear, numbered execution plan
- Include: files to change, why, and expected outcome
- If the task touches Firestore schema or API routes, re-read `docs/DATABASE.md` or `docs/API.md`

**Step 3 — Request Approval**

- Present the plan to the user
- Wait for explicit confirmation before writing any code
- Do NOT proceed if the user asks for changes to the plan

**Step 4 — Execute**

- Implement only what was approved in Step 3
- Follow all conventions defined in the Code Conventions section above

**Step 5 — Write Tests**

- Write Vitest unit tests for any modified logic in `verify/`
- Follow the spec format defined in `docs/VERIFICATION.md`
- Run: `npm run verify` — all tests must pass before continuing

**Step 6a — Run E2E Tests**

- Write or update Playwright tests covering the changed UI/API flows
- Run Playwright tests against `localhost:3000` (ensure dev server is running)

**Step 6b — Debug Loop (if tests fail)**

- Analyze failure → fix → re-run tests
- Repeat until all Vitest and Playwright tests pass
- Do NOT report completion while any test is failing

**Step 7 — Report**

- Summarize what was changed, which files were modified, and test results
- Flag any known limitations or follow-up items

### Hard Rules

- Never skip Step 3 (approval) — not even for "small" changes
- Never modify files under `docs/` without user confirmation (see Gotchas)
- Never delete Firestore documents or Anki notes without user confirmation
- If scope expands mid-task, stop and re-present an updated plan for approval
