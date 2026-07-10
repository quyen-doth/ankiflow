---
name: ui-component
description: >
  Create or modify UI components and styling in ankiflow (Tailwind CSS v4 +
  design tokens). Use when: user mentions @ui-component, creates/edits a React
  component, changes styling/design tokens, or debugs missing/incorrect styles.
  Read docs/DESIGN.md before any UI work.
---

# Skill: UI Component

## Goal
Every component matches the design system in `docs/DESIGN.md` and the real token
definitions in `app/globals.css` — no ad-hoc colors, sizes, or shadows.

---

## Step 1 — Required context

1. `docs/DESIGN.md` — design system (Japanese)
2. `app/globals.css` — the actual `@theme` tokens (single source for colors, font sizes, radius, shadows)
3. `components/ui/` — existing primitives (Button, Badge, Card, Modal, DataTable, Tabs, FormField...) — reuse before creating new ones

---

## Step 2 — Component conventions

- **Named exports only** — no default exports
- Flat files: `components/[category]/PascalCase.tsx` (categories: `ui/`, `layout/`, `create/`, `preview/`, `history/`, `admin/`, `settings/`, `review/`, `providers/`) — do NOT create `ComponentName/index.tsx` folders
- Server components by default — add `'use client'` only when the component needs state/effects/browser APIs
- All user-facing UI text in **English** (Language Policy)
- Class merging via `cn()` from `lib/utils.ts` — never concatenate class strings manually

---

## Step 3 — Design tokens (Tailwind CSS v4 — CSS-first `@theme`)

Tokens are defined in `app/globals.css` inside `@theme`. Use utility classes derived
from them (`bg-primary`, `text-ink`, `rounded-card`, `shadow-button`...) — never
hardcode hex values or px in components.

### ⚠️ Gotcha 1 — font-size token naming (real bug, 2026-07-09)

Tailwind v4 font-size tokens MUST follow this exact naming or the utilities
silently do nothing:

```css
--text-page-title:              24px;   /* --text-{name} */
--text-page-title--line-height: 1.1;    /* --text-{name}--line-height */
--text-page-title--font-weight: 800;    /* --text-{name}--font-weight */
```

(`--font-size-*` / `--line-height-*` / `--font-weight-*` are NOT recognized.)

### ⚠️ Gotcha 2 — custom font-size tokens vs tailwind-merge (real bug, 2026-07-09)

`cn()` in `lib/utils.ts` uses `extendTailwindMerge` with a custom `font-size`
classGroup. Any NEW custom font-size token (`text-<name>`) MUST be registered there,
otherwise `twMerge` misclassifies it against text-color utilities and silently
strips classes like `text-on-primary`:

```typescript
// lib/utils.ts — add new token names here
'font-size': [
  { text: ['page-title', 'section-heading', 'body', 'secondary', 'overline', 'meta'] },
],
```

---

## Step 4 — Checklist before finishing

- [ ] Reused an existing `components/ui/` primitive where possible?
- [ ] No hardcoded colors/sizes — tokens only?
- [ ] New font-size token registered in BOTH `globals.css` (`--text-*` naming) and `lib/utils.ts` classGroups?
- [ ] Named export, flat file, correct category folder?
- [ ] `'use client'` only if actually needed?
- [ ] UI text in English?

---

## Step 5 — Verify visually

Do not claim styling is done from code alone — verify in the browser (dev server at
`localhost:3000`, Playwright/browser tools). Note: after `@theme` changes, Turbopack
sometimes needs a dev-server restart to pick them up.

If the design system materially changed → suggest updating `docs/DESIGN.md`
(requires user confirmation).
