---
name: anki-connect
description: >
  Work with the AnkiConnect integration of ankiflow (export/sync cards to Anki,
  deck/model/media operations). Use when: user mentions @anki-connect, touches
  export/sync flows, debugs "Failed to fetch" from Anki calls, or adds a new
  Anki operation. Do NOT create/delete Anki notes or decks without user confirmation.
---

# Skill: AnkiConnect Integration

## The one architectural rule

**AnkiConnect calls run CLIENT-SIDE only.** The browser calls the user's own
`http://localhost:8765` directly. The server NEVER calls AnkiConnect — on Vercel,
the server's localhost is not the user's machine; only the user's browser can
reach their Anki Desktop.

Standard flow: **server returns data (Firestore) → browser executes Anki commands →
browser POSTs results back to the server** (e.g. saving `anki_note_ids` on the entry).

Never add an AnkiConnect call inside an `app/api/**/route.ts` handler.

---

## File map

| File | Role |
| --- | --- |
| `lib/flashcard-service/client.ts` | Browser entry point — `getAnkiClientFromSettings()` (resolves URL from `settings/{uid}.anki_connect_url`, falls back to `localhost:8765`, cached per session; call `resetAnkiClientCache()` after the user changes the URL) |
| `lib/flashcard-service/anki-connect-provider.ts` | `AnkiConnectProvider` — raw `invoke(action, params)` against AnkiConnect API version 6 |
| `lib/flashcard-service/client-ops.ts` | High-level ops shared by direct export and later sync: `ensureModel`, `ensureDeck`, `createNotesForEntry`, `regenerateNotesForEntry`, `syncAllDecks`, `deleteDeckWithCleanup`, `storeAudioMedia`, `storeImageMedia` |
| `lib/flashcard-service/types.ts` | `IFlashcardService`, `AnkiNote`, `AnkiCardInfo`... |
| `lib/anki/` | `model.ts` (note model), `renderCard.ts`, `extractMedia.ts`, `regenerateEntryNotes.ts` |
| `lib/buildNotes.ts` | Builds Anki note payloads from an entry |

Reuse `client-ops.ts` functions — do not re-implement note creation; direct export
(`useAnkiExport`) and later sync share the same path on purpose.

---

## Error handling (mandatory)

- Requirements for the user: Anki Desktop open + AnkiConnect addon installed +
  the app origin added to `webCorsOriginList` in the addon config
  (Tools → Add-ons → AnkiConnect → Config) when using the deployed app
- **"Anki is closed" and "CORS not allowed" are indistinguishable in the browser** —
  both throw `TypeError: Failed to fetch`. Every AnkiConnect call needs explicit
  error handling, and error messages shown to the user must mention BOTH possible causes
- AnkiConnect responses have the shape `{ result, error }` — a 200 response can still
  carry `error !== null`; always check it
- Media failures are non-fatal: `storeAudioMedia`/`storeImageMedia` warn and let the
  card export without audio/image

---

## Hard rules

- **NEVER** call AnkiConnect from server code (API routes, server components)
- **NEVER** create or delete Anki notes/decks without explicit user confirmation
  (the `deleteNotes`/`deleteDecks` guard hook enforces part of this)
- After a successful export, persist the resulting `anki_note_ids` back to the entry
  (status becomes `synced`)
- Keep model/deck creation idempotent — always go through `ensureModel`/`ensureDeck`
