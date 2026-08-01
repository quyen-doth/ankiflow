---
name: api
description: >
  Create or modify API endpoints in ankiflow (Next.js App Router route handlers).
  Use when: user mentions @api, adds a new endpoint, changes a response type,
  adds validation, or asks about the current API conventions.
  Do NOT use for UI or components.
---

# Skill: API Development

## Goal
Every endpoint created or modified must be consistent with `docs/API.md`
— correct format, correct error handling, correct auth layer, reusing existing helpers.

---

## Step 1 — Required context

1. `docs/API.md` — full list of existing endpoints, standard response format, error codes
2. `lib/auth-guard.ts` — `withAuth`, `withAdmin`, `verifySessionUser`, `verifyStaticToken`
3. `lib/api-response.ts` — standard response helpers (`apiSuccess`, `apiError`, `catchError`)
4. `lib/validation.ts` — zod schemas + `parseBody` helper
5. `lib/firestore-helpers.ts` — `withTimestamps` for created_at/updated_at

> Check whether a similar endpoint already exists before creating a new one.
> This is plain Next.js (App Router) — there is **no Fastify** in this project.

---

## Step 2 — Auth layers (MUST pick the right one)

Auth is Firebase **session cookie** (`__session`, httpOnly). Middleware only checks the
cookie *exists*; real verification happens per-route in `lib/auth-guard.ts`.

| Route kind | Mechanism |
| --- | --- |
| Normal authenticated per-user routes (entries, history, dashboard) | `withAuth(handler(req, ctx, uid))` — verifies the session cookie (`verifySessionCookie`, checkRevoked) and passes `uid` as the 3rd argument; returns 401 `{ error: 'Unauthorized' }` if invalid |
| Custom authenticated per-user route (`/api/notifications/send`) | `verifySessionUser(req)` followed by reads and writes scoped to `sessionUser.uid`; this route is not admin-gated |
| Mixed admin Content Types route (`/api/admin/content-types`) | `GET` uses `withAuth`; global control-plane mutations `PUT` / `DELETE` use `withAdmin` |
| Mixed global config route (`/api/admin/global-config`) | `GET` uses `verifySessionUser`; `POST` additionally checks `email === process.env.ADMIN_EMAIL` (the older manual equivalent of `withAdmin`) and returns 403 otherwise |
| Cron / external integrations (`/api/cron/*`, `/api/integrations/*`) | `verifyStaticToken(provided, expected)` — timing-safe static token compare, no cookie |
| Unauthenticated | only `/api/auth/*` and `/api/notifications/line-webhook` (excluded in `middleware.ts`) |

There is **no `x-api-secret` header and no `withAuthGuard`** — those belonged to an old version.

**Admin control-plane mutations MUST use `withAdmin` (or an equivalent explicit
`ADMIN_EMAIL` check). Never protect them with `withAuth` alone.** Admin SDK calls bypass
Firestore Security Rules, so authentication without the admin authorization check is insufficient.

**Per-user data:** server writes MUST set `user_id: uid`; queries on per-user collections
MUST filter by `user_id` (see the `database` skill).

---

## Step 3 — Required conventions

### Naming:
```
GET    /api/[resource]          ← list (filters via query params)
GET    /api/[resource]/[id]     ← single item
POST   /api/[resource]          ← create
PUT    /api/[resource]          ← update (id in body, no [id] segment)
DELETE /api/[resource]?id=...   ← delete/deactivate (id via query param)
```

### Standard response format (per `lib/api-response.ts` and `docs/API.md`):
```typescript
// Success — apiSuccess(data, status?)
{ ...data }              // e.g. { categories: [...] }, { success: true, id: '...' }

// Error — apiError(message, status) or catchError(error)
{ error: string }         // NO "code" field
```

### Common HTTP status codes:
```
200 OK / 201 Created   ← success
400 Bad Request        ← parseBody validation failure
401 Unauthorized       ← missing/invalid session cookie (withAuth)
403 Forbidden          ← authenticated but not admin (ADMIN_EMAIL check)
404 Not Found          ← resource does not exist
500 Internal Error     ← catchError default
```

---

## Step 4 — Boilerplate (follows the UID-scoped pattern used by `app/api/dashboard/route.ts`)

```typescript
// app/api/[resource]/route.ts

import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth-guard'
import { getAdminDb } from '@/lib/firebase-admin'
import { withTimestamps } from '@/lib/firestore-helpers'
import { apiSuccess, apiError, catchError } from '@/lib/api-response'
import { parseBody, ResourceSchema } from '@/lib/validation'

async function GET_handler(request: NextRequest, _ctx: unknown, uid: string) {
  try {
    const db = getAdminDb()
    const snapshot = await db.collection('resource').where('user_id', '==', uid).get()
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    return apiSuccess({ items })
  } catch (error) {
    return catchError(error)
  }
}

async function POST_handler(request: NextRequest, _ctx: unknown, uid: string) {
  try {
    const parsed = parseBody(ResourceSchema, await request.json())
    if (!parsed.ok) return parsed.response

    const db = getAdminDb()
    const docRef = await db.collection('resource').add(
      withTimestamps({ ...parsed.data, user_id: uid }, true)
    )
    return apiSuccess({ success: true, id: docRef.id }, 201)
  } catch (error) {
    return catchError(error)
  }
}

export const GET = withAuth(GET_handler)
export const POST = withAuth(POST_handler)
```

---

## Step 5 — Checklist before finishing

- [ ] Input validation uses `parseBody` + a zod schema (schema lives in `lib/validation.ts`)?
- [ ] Error handling uses `catchError`/`apiError` (no hand-rolled `NextResponse.json`)?
- [ ] Response shape matches `apiSuccess`/`apiError` (no `code` field)?
- [ ] Correct auth layer chosen (`withAuth` / `withAdmin` / explicit `verifySessionUser` + `ADMIN_EMAIL` / `verifyStaticToken`)?
- [ ] Admin control-plane mutations use `withAdmin` (or an equivalent explicit `ADMIN_EMAIL` check), never `withAuth` alone?
- [ ] Server writes set `user_id: uid`; per-user queries filter by `user_id`?
- [ ] Does the new endpoint conflict with an existing one?

---

## Step 6 — After creating

```
✅ Created: POST /api/[resource]

💡 Do you want me to update docs/API.md to register this endpoint?
```

---

## Hard rules

- Do **NOT** create an endpoint before reading `docs/API.md`
- Do **NOT** reinvent the response/error format — use `apiSuccess`/`apiError`/`catchError`
- Do **NOT** call AnkiConnect from the server — it is client-side only (see the `anki-connect` skill)
- **MUST** have error handling — never let an endpoint throw an uncaught error
