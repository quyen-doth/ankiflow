# REFERENCE.md

Tài liệu tra cứu chi tiết — Claude Code đọc file này khi cần thông tin cụ thể, không cần giữ thường trực trong context như CLAUDE.md.

## Architecture

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

## Git Conventions

```
feat:     New feature
fix:      Bug fix
docs:     Documentation only
refactor: Refactor without new features
chore:    Config, build, dependencies
```

Example: `feat: add POST /api/entries endpoint`
