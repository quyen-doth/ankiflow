# AGENTS.md — AnkiFlow

> This file is read by the AI agent at the start of each new session.
> It serves as the primary source of information regarding the project, conventions, and working rules.

---

## Project Overview

**AnkiFlow** is a web app that helps create and manage multilingual vocabulary,
integrating directly with Anki via AnkiConnect.

**Target Users:** Language learners (English, Chinese, Japanese) and IT vocabulary learners.

**Core Workflow:**

```
Input vocabulary → AI enriches data → Export to Anki → Review
```

---

## Tech Stack

| Layer            | Technology                   |
| ---------------- | ---------------------------- |
| Framework        | Next.js (App Router)         |
| Language         | TypeScript (strict mode)     |
| Database         | Google Firestore (NoSQL)     |
| Styling          | Tailwind CSS                 |
| Anki Integration | AnkiConnect (local HTTP API) |
| AI               | Gemini API                   |
| Media            | Unsplash API, TTS            |

---

## Docs Structure

All documentation is located in `docs/`. This is the source of truth — read the appropriate file before starting work:

| File                       | Content                            | When to Read                          |
| -------------------------- | ---------------------------------- | ------------------------------------- |
| `docs/prd.md`              | Product requirements, scope        | Starting a new feature                |
| `docs/tasks.md`            | Task list, status                  | Checking pending tasks / things to do |
| `docs/API.md`              | Endpoints, request/response format | Writing or calling APIs               |
| `docs/DATABASE.md`         | Firestore schema, enum values      | Writing queries or adding fields      |
| `docs/design/DESIGN.md`    | Design system, tokens, spacing     | Creating or modifying UI              |
| `docs/design/COMPONENT.md` | List of existing components        | Before creating a new component       |

---

## Skills Available

Use the following skills instead of guessing the process:

| Skill          | When to Use                         |
| -------------- | ----------------------------------- |
| `@init`        | Starting a new feature              |
| `@design`      | Creating or modifying UI components |
| `@api`         | Adding or modifying API endpoints   |
| `@debug`       | When there are bugs to fix          |
| `@deploy`      | Preparing for deployment            |
| `@update-docs` | After code changes                  |
| `@database`    | Querying Firestore or adding fields |

---

## Code Conventions

### TypeScript

- Strict mode enabled — do not use `any`
- Use `interface` for object shapes, `type` for unions/intersections
- `import type` for type-only imports
- Do not use `default export` for components — use named exports

### Next.js App Router

- Route file: `app/[feature]/page.tsx`
- API route: `app/api/[resource]/route.ts` — the filename must be `route.ts`
- Server components by default — only add `'use client'` when necessary

### Firestore

- Do not call Firestore inside loops — use `Promise.all()` for batch fetching
- Do not hardcode strings for `form_type` and `status` — use TypeScript enums/types
- Check `docs/DATABASE.md` for exact field names and enum values

### Naming

- Folder: `kebab-case`
- Component: `PascalCase.tsx`
- Utility/hook: `camelCase.ts`
- Constant: `UPPER_SNAKE_CASE`

---

## Important Enum Values

### `form_type`

```
form_general    General vocabulary
form_it         IT / Technology vocabulary
form_language   Language vocabulary (English, Chinese, Japanese)
```

### `status` (entries)

```
draft      Drafting / In progress
ready      Ready to export to Anki
exported   Exported to Anki
archived   Hidden / Unused
```

---

## Safety Guardrails

The following actions **strictly require user confirmation before execution:**

- Writing or deleting documents in Firestore
- Calling the AnkiConnect API (creating/deleting notes in Anki)
- Deploying to production
- Deleting files in the codebase
- Updating any file in `docs/`

> **Principle:** Propose first — apply only after the user says "ok" or "apply".

---

## Git Conventions

```
feat:     New feature
fix:      Bug fix
docs:     Documentation changes only
refactor: Refactoring code, no new features added
chore:    Configuration, builds, dependencies
```

Example: `feat: add POST /api/entries endpoint`

---

## Project-Specific Gotchas

- **AnkiConnect runs locally** — it only works when Anki is open on the user's machine. All calls to AnkiConnect must include clear error handling for cases where Anki is closed.

- **Firestore does not support JOINs** — when data from multiple collections is required, it must be batch fetched using `Promise.all()`, instead of fetching sequentially within loops.

- **`form_type` is the primary routing field** — many components and queries filter by this field. Incorrect `form_type` → wrong form rendered, incorrect data loaded.

- **Language-specific fields are optional** — `pinyin`, `hiragana`, `ipa`... only hold values when the corresponding `language` matches. Do not assume these fields always have values.

- **`settings` is a singleton** — there is only 1 document within this collection. Do not create new documents; only update the existing one.
