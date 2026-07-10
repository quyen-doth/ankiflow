---
name: init
description: >
  Initialize a new feature or module in the ankiflow project.
  Use when: user mentions @init, starts building a new feature,
  needs the standard file/folder structure, or asks "where do I start".
  Do NOT use for modifying existing code.
---

# Skill: Init Feature

## Goal
Initialize new features following ankiflow conventions — consistent structure,
read the right docs before creating files, never guess the architecture.

---

## Step 1 — Required context

Before creating any file, read:
1. `docs/PRD.md` — understand scope and business logic
2. `docs/DESIGN.md` — if the feature has UI
3. `docs/API.md` — if the feature adds a new API endpoint
4. `docs/DATABASE.md` — if the feature touches Firestore

---

## Step 2 — Ask before creating

Confirm with the user:
> "Which layer does this feature belong to: UI component, API route, or both?"

---

## Step 3 — Create the standard structure

### UI feature (Next.js App Router):
```
app/
└── [feature-name]/
    ├── page.tsx          ← main route
    ├── layout.tsx        ← only if a dedicated layout is needed
    └── components/       ← feature-local components
        └── [Component].tsx

components/                  ← shared components
└── [category]/              ← e.g. create/, preview/, admin/, ui/
    └── [Component].tsx      ← flat file, do NOT create a folder + index.tsx
```

### API route (Next.js App Router — no Fastify in this project):
```
app/
└── api/
    └── [feature-name]/
        └── route.ts      ← Next.js route handler, use helpers in lib/api-response.ts, lib/auth-guard.ts
```
> See the `api` skill for convention details (response format, auth guard, validation).

### Naming conventions:
- Folder: `kebab-case`
- Component file: `PascalCase.tsx`
- API route: `route.ts` (Next.js convention)
- Utility/helper: `camelCase.ts`

---

## Step 4 — Create files with minimal boilerplate

Create the skeleton only — do NOT write unconfirmed business logic:

```tsx
// page.tsx boilerplate
export default function [FeatureName]Page() {
  return <div>[FeatureName]</div>
}
```

---

## Step 5 — Report

After creating:
```
✅ Initialized: [feature-name]
New files:
- app/[feature-name]/page.tsx
- app/[feature-name]/components/...
```

---

## Hard rules

- Do **NOT** create files before reading `docs/PRD.md`
- Do **NOT** create more than the current step requires
- **MUST** ask if the feature name or scope is unclear
