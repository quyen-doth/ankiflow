# REFERENCE.md

Tài liệu tra cứu chi tiết — Claude Code đọc file này khi cần thông tin cụ thể, không cần giữ thường trực trong context như CLAUDE.md.

## Architecture

### Request Flow

```
Browser UI ─┬→ AnkiConnect (localhost:8765 CỦA USER — gọi trực tiếp, cần CORS)
            └→ Next.js API Routes → External Services
                                     ├── Firestore (Admin SDK)
                                     ├── Claude API (Anthropic)
                                     ├── Google TTS
                                     └── Unsplash
```

> **AnkiConnect chạy client-side (từ 2026-07-04):** server KHÔNG BAO GIỜ gọi AnkiConnect (trên Vercel, localhost của server không phải máy user). Mọi lệnh Anki đi qua `lib/flashcard-service/client.ts` (factory + resolve URL từ `settings.anki_connect_url`) và `client-ops.ts` (ensureModel, deck ops, createNotesForEntry, regenerateNotesForEntry). Pattern: server trả data → browser thao tác Anki → browser POST kết quả về server.

### AnkiConnect CORS Setup (bắt buộc)

Browser gọi `localhost:8765` bị AnkiConnect chặn CORS theo mặc định (chỉ cho phép origin `http://localhost`). User phải config 1 lần:

1. Anki Desktop → **Tools → Add-ons → AnkiConnect → Config**
2. Thêm origin của app vào `webCorsOriginList`:
   ```json
   {
     "webCorsOriginList": [
       "http://localhost",
       "http://localhost:3000",
       "https://<your-app>.vercel.app"
     ]
   }
   ```
3. **Restart Anki.**

Lưu ý:
- Thiếu CORS → browser báo `TypeError: Failed to fetch` (không phân biệt được với "Anki đóng" — browser giấu chi tiết CORS khỏi JS). Settings page có callout hướng dẫn khi Anki offline.
- **Safari** chặn request từ trang HTTPS đến `http://localhost` → dùng Chrome/Edge/Firefox cho bản deploy.

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
5. User edits card, selects image/audio, then:
   - **Export (Anki mở):** browser gọi `createNotesForEntry` (store media + buildNotes + createDeck + addNotes trực tiếp qua AnkiConnect) → `POST /api/entries/save` với `status: 'synced'` + note ids
   - **Save (Anki đóng — deferred):** `POST /api/entries/save` với status mặc định `reviewed`; sync sau qua nút Sync ở sidebar (`GET /api/entries/sync` → browser tạo notes → `POST /api/entries/sync`)

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
| `API_SECRET`                                         | Random string — used as `x-api-secret` header for `/api/admin/*` and `/api/history/*` |

> `ANKI_CONNECT_URL` đã bị loại bỏ (2026-07-04) — URL AnkiConnect giờ per-user, đọc client-side từ `settings.anki_connect_url` (fallback `http://localhost:8765`).

## API Authentication

- `/api/entries/*`, `/api/anki/*` (update/resync/sync-srs) and `/api/generate` — public (safe when running locally; sẽ được bảo vệ bởi Firebase Auth theo `flashcard/plans/firebase-auth-plan-2026-06-30.md`)
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
