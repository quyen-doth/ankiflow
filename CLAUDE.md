# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**AnkiFlow** is a web app for creating and managing multilingual vocabulary flashcards, integrated directly with Anki via the AnkiConnect local plugin.

Core workflow: `Enter vocabulary → AI enriches content → Preview/edit → Export to Anki → Study`

Supported content types: Language vocab (English, Chinese, Japanese) and IT vocabulary.

The app code lives in `ankiflow/`. The `anki_flow_design/` directory contains static HTML design mockups only.

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

To seed Firestore: `cd ankiflow && npm run seed`

## Architecture

### Tech Stack

- **Next.js 16** (App Router) — TypeScript strict mode
- **Firestore** (Firebase Admin SDK on server, Firebase client SDK on browser)
- **Tailwind CSS v4**
- **Claude API** (`claude-haiku-4-5`, via `@anthropic-ai/sdk`) — tool-based AI agent for content generation
- **Google Cloud TTS** — audio generation
- **Unsplash API** — vocabulary images
- **AnkiConnect** — local HTTP API at `localhost:8765` (requires Anki Desktop open)

### Request Flow

```
Browser UI → Next.js API Routes → External Services
                                   ├── Firestore (Admin SDK)
                                   ├── AnkiConnect (localhost:8765)
                                   ├── Claude API (Anthropic)
                                   ├── Google TTS
                                   └── Unsplash
```

### Key Directories

| Path                     | Purpose                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------- |
| `app/api/`               | API routes — all server logic lives here                                                |
| `app/dashboard/`         | Dashboard — stats overview, recent entries, quick actions                               |
| `app/create/`            | Create card page (form selection + input)                                               |
| `app/preview/`           | Preview generated card, edit, export to Anki                                            |
| `app/history/`           | History log of created entries                                                          |
| `app/history/[id]/`      | History detail — full entry view, recreate/delete                                       |
| `app/settings/`          | Settings — integration status, AnkiConnect URL, Claude model, feature toggles           |
| `app/admin/`             | Admin — CRUD for categories, card types, topics, decks, content types                   |
| `components/create/`     | Form components per content type                                                        |
| `components/preview/`    | Card preview + edit components                                                          |
| `components/history/`    | History table, word detail card                                                         |
| `components/admin/`      | Admin manager components per resource (CategoryManager, etc.)                           |
| `components/layout/`     | Navigation sidebar, page header                                                         |
| `components/ui/`         | Shared UI primitives (Button, Modal, Card, DataTable, etc.)                             |
| `lib/`                   | Shared utilities: firebase, session, TTS, Unsplash                                      |
| `lib/ai-agent/`          | Claude AI agent — provider, card schemas (zod), tool orchestration                      |
| `lib/prompts/`           | Per-language system prompts for the AI agent                                            |
| `lib/flashcard-service/` | AnkiConnect provider abstraction                                                        |
| `types/index.ts`         | All TypeScript types and enums                                                          |
| `verify/`                | Runtime verification framework (specs, verifiers, harness — see `docs/VERIFICATION.md`) |
| `docs/`                  | Source-of-truth documentation                                                           |

### Data Flow: Create → Preview

1. User fills `app/create/page.tsx` form
2. On submit, calls `POST /api/generate` → Claude AI agent enriches content
3. Result saved to `localStorage` via `lib/pendingEntry.ts` (`ankiflow_pending_result`)
4. Browser redirects to `app/preview/page.tsx`, which reads and clears pending entry
5. User edits card, selects image/audio, then exports via `POST /api/anki/create`
6. Anki create: pushes notes to AnkiConnect + saves Entry log to Firestore

### Session Persistence

`lib/session.ts` persists form configuration (deck, language, card types, tags) in `localStorage` keyed by `form_type`. Content fields reset between entries; config fields persist across entries.

## Code Conventions

### TypeScript

- Strict mode — no `any`
- `interface` for object shapes, `type` for unions/intersections
- `import type` for type-only imports
- Named exports only for components — no default exports

### Next.js App Router

- Server components by default — add `'use client'` only when needed
- API routes: `app/api/[resource]/route.ts`
- Client-side Firestore (firebase SDK) vs server-side Firestore (firebase-admin SDK) — do not mix

### Naming

- Folders: `kebab-case`
- Components: `PascalCase.tsx`
- Utilities/hooks: `camelCase.ts`
- Constants: `UPPER_SNAKE_CASE`

### Firestore

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

| Value      | Meaning         |
| ---------- | --------------- |
| `draft`    | In progress     |
| `ready`    | Ready to export |
| `exported` | Pushed to Anki  |
| `archived` | Hidden          |

## Environment Variables

Copy `.env.example` to `.env.local`:

| Variable                                             | Source                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `FIREBASE_ADMIN_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` | GCP service account                                                                   |
| `NEXT_PUBLIC_FIREBASE_*`                             | Firebase Console → Project Settings                                                   |
| `ANTHROPIC_API_KEY`                                  | Anthropic Console (Claude API)                                                        |
| `GOOGLE_TTS_API_KEY`                                 | Google Cloud Console                                                                  |
| `UNSPLASH_ACCESS_KEY`                                | Unsplash Developers                                                                   |
| `ANKI_CONNECT_URL`                                   | Default: `http://localhost:8765`                                                      |
| `API_SECRET`                                         | Random string — used as `x-api-secret` header for `/api/admin/*` and `/api/history/*` |

## API Authentication

- `/api/anki/*` and `/api/generate` — public (safe when running locally)
- `/api/admin/*` and `/api/history/*` — require `x-api-secret` header matching `API_SECRET` env var (see `lib/auth-guard.ts`)

## Docs

`ankiflow/docs/` is the source of truth — read before making changes:

| File                       | Read when                                           |
| -------------------------- | --------------------------------------------------- |
| `docs/prd.md`              | Starting a new feature                              |
| `docs/tasks.md`            | Checking what needs to be done                      |
| `docs/API.md`              | Writing or calling any API route                    |
| `docs/DATABASE.md`         | Writing Firestore queries or adding fields          |
| `docs/design/DESIGN.md`    | Creating or modifying UI                            |
| `docs/design/COMPONENT.md` | Before creating a new component                     |
| `docs/VERIFICATION.md`     | Writing or modifying verification specs (`verify/`) |

## Gotchas

- **AnkiConnect is local** — only works when Anki Desktop is open. All AnkiConnect calls need explicit error handling for the disconnected case.
- **Language-specific fields are optional** — `pinyin`, `hiragana`, `ipa`, etc. only exist when `language` matches. Never assume these fields have values.
- **`form_type` drives everything** — it determines which form renders, which AI-agent prompt/schema runs, and which Firestore data loads. Mismatched `form_type` causes silent wrong behavior.
- **No JOIN in Firestore** — related documents must be fetched with `Promise.all()`, never sequentially in a loop.
- **Actions requiring user confirmation before execution:** writing/deleting Firestore documents, calling AnkiConnect (creates/deletes Anki notes), deleting codebase files, updating any file under `docs/`.

## Git Conventions

```
feat:     New feature
fix:      Bug fix
docs:     Documentation only
refactor: Refactor without new features
chore:    Config, build, dependencies
```

Example: `feat: add POST /api/entries endpoint`

## Mandatory Workflow for Code Changes

> Apply this workflow to ALL tasks involving code modification: debugging, new features, refactoring, or any change to the codebase.

### Steps (must follow in order — do not skip)

**Step 1 — Read & Understand**

- Read all files relevant to the task
- Read the corresponding `docs/` file(s) listed in the Docs table above
- Fully understand the current behavior before planning anything

**Step 2 — Plan**

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
