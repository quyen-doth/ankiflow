---
name: database
description: >
  Look up or update the Firestore database structure of ankiflow.
  Use when: user mentions @database, asks about a collection/field,
  writes Firestore query code, adds a new field to a collection,
  asks about enum values (form_type, status...), or designs a new data model.
  Do NOT change the schema without user confirmation.
---

# Skill: Database

## Goal
All Firestore-related code must match the schema in `docs/DATABASE.md`
— correct field names, correct types, correct enum values, and the per-user isolation rule.

---

## Step 1 — Required context

Read `docs/DATABASE.md` before:
- Writing any Firestore query
- Creating or modifying a TypeScript interface/type for data
- Adding a new field to a collection

Enums live in `types/index.ts` (there is no `types/database.ts`).

---

## Step 2 — Quick Reference (verified against `types/index.ts`)

### `FormType` (enum — never hardcode the strings)
```typescript
import { FormType } from '@/types'
// FormType.LANGUAGE = 'form_language'  → Language vocab (EN/ZH/JA)
// FormType.IT       = 'form_it'        → IT vocabulary
// FormType.GENERAL  = 'form_general'   → General knowledge
```

### Entry `status` (`types/index.ts:106`)
```
draft     → In progress
reviewed  → AI-enriched, ready for export
synced    → Exported to Anki successfully
```

---

## Step 3 — Per-user isolation (THE most important rule)

Every query on **`entries` / `decks` / `categories` / `card_types` / `topics` /
`notification_triggers`** MUST filter `where('user_id', '==', uid)`:

- Client-side: `uid` from `useAuth()` — and wait for `useAuth().loading === false` first
- Server-side: `uid` from the `withAuth` handler's 3rd argument; server writes set `user_id: uid`

Exception: **`content_types` is SHARED** (doc id = `form_type`) — read by all, written by admin only.

`settings` is NOT a singleton — three doc kinds: `settings/{uid}` (per-user prefs),
`settings/global` (feature flags), `settings/default` (admin secrets — never read from a non-admin client).

Firestore Security Rules (`firestore.rules`) are live: a client query missing the
`user_id` filter is **denied by rules**, not just wrong. When adding a new collection
or query shape, update `firestore.rules` (+ indexes) and deploy:
`firebase deploy --only firestore:rules,firestore:indexes`.

---

## Step 4 — Standard Firestore queries

### Client SDK (browser):
```typescript
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { FormType } from '@/types'

const q = query(
  collection(db, 'entries'),
  where('user_id', '==', uid),               // ← mandatory
  where('form_type', '==', FormType.LANGUAGE),
  where('status', '==', 'reviewed'),
  orderBy('created_at', 'desc')
)
const snapshot = await getDocs(q)
const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
```

### Batch fetch relations (no JOIN — never call Firestore in a loop):
```typescript
const categoryIds = [...new Set(entries.map(e => e.category_id))]
const categories = await Promise.all(
  categoryIds.map(id => getDoc(doc(db, 'categories', id)))
)
```

> Server routes use the Admin SDK (`getAdminDb()` from `lib/firebase-admin.ts`) which
> bypasses rules — never mix the two SDKs in one file.

---

## Step 5 — Adding a new field to a collection

Required process:
1. Identify which collection the field belongs to
2. Determine its type and whether it is optional
3. Check impact on existing queries (Firestore indexes) and on `firestore.rules`
4. Create a proposal:

```
📋 SCHEMA CHANGE PROPOSAL
==========================
Collection: entries
New field: sync_status (string, optional)
Enum values: pending | syncing | synced | failed
Reason: track sync state with AnkiConnect

Impact:
- TypeScript interface in types/index.ts must be updated
- Firestore index needed if querying by this field
- firestore.rules unchanged / needs update
```

5. Wait for user confirmation → update `docs/DATABASE.md`

---

## Hard rules

- Do **NOT** hardcode strings for `form_type` and `status` — use the enums/types in `types/index.ts`
- Do **NOT** write any per-user query without the `user_id` filter
- Do **NOT** add a field to a Firestore document without updating `docs/DATABASE.md`
- Do **NOT** delete a field before confirming it is no longer used
- **MUST** use `Promise.all()` for batch fetches — never call Firestore in a loop
- Language-specific fields (`pinyin`, `hiragana`, `ipa`...) are optional — never assume they exist
- If a query requires a new index or rules change → warn the user before deploying
