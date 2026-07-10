---
name: update-docs
description: >
  Sync the documentation in docs/ after code changes. Use when:
  user mentions @update-docs, an API endpoint was added/changed/removed,
  a component was created or modified, a data model or schema changed,
  a task status changed, or the design system / conventions changed.
  Do NOT update docs when no real code change happened.
---

# Skill: Update Docs

## Goal
Keep `docs/` the **source of truth** that accurately reflects the current
state of the codebase — nothing extra, nothing missing, nothing stale.

> Files in `docs/` are written in **Japanese** (see Language Policy in CLAUDE.md).

---

## Mapping: which change → which file

| Change type                                        | File to update         |
|----------------------------------------------------|------------------------|
| Add / modify / remove API endpoint                 | `docs/API.md`          |
| Firestore schema, query pattern, enum change       | `docs/DATABASE.md`     |
| Design tokens, component patterns, layout, theme   | `docs/DESIGN.md`       |
| Directory structure, data flow, env vars           | `docs/REFERENCE.md`    |
| Verification spec format / harness change          | `docs/VERIFICATION.md` |
| Git workflow / conventions change                  | `docs/CONTRIBUTING.md` |
| Change business logic / major scope                | `docs/PRD.md`          |

> **Principle:** update only the relevant file. Do not touch the others.

---

## Process

### Step 1 — Read & analyze
1. Read the docs file(s) related to the change (per the mapping above)
2. Read the changed code files to understand exactly what changed
3. Classify: addition / modification / removal / rename?

### Step 2 — Create a proposal (do NOT write immediately)
Produce a **diff proposal** in this form:

```
📋 DOCS UPDATE PROPOSAL
========================
File: docs/API.md

[ADD]
### POST /api/cards
...proposed content...

[MODIFY]
Old: GET /api/decks → returns array
New: GET /api/decks → returns { data: Deck[], total: number }

[REMOVE]
### DELETE /api/legacy-sync  ← endpoint was removed
```

### Step 3 — Wait for confirmation
**STOP** and ask the user:
> "Do you want me to apply these changes to `docs/API.md`?"

Continue only after the user confirms with **"ok"** or **"apply"**.

### Step 4 — Apply & report
1. Write the changes into the correct docs file (in Japanese)
2. Report briefly:
   ```
   ✅ Updated: docs/API.md
   - Added: POST /api/cards
   - Modified: response type of GET /api/decks
   - Removed: DELETE /api/legacy-sync
   ```

---

## Hard rules

- Do **NOT** update `docs/PRD.md` unless the user explicitly asks — it holds product decisions, not technical specs
- Do **NOT** delete docs content without quoting it to the user first
- Do **NOT** rewrite whole files — make surgical edits to the relevant section only
- **MUST** preserve each file's existing format and heading structure
- If unsure which file a change belongs to → ask the user first

---

## Natural trigger examples

- *"just finished the create-card endpoint"* → update `docs/API.md`
- *"added a field to entries"* → update `docs/DATABASE.md`
- *"@update-docs"* → ask: what change just happened?
- *"the Button component styling changed"* → update `docs/DESIGN.md`
