---
name: deploy
description: >
  Prepare and perform ankiflow deployments. Use when: user mentions @deploy,
  asks "ready to deploy?", wants a check before pushing to production,
  or needs a deploy checklist. Do NOT deploy without user confirmation.
---

# Skill: Deploy

## Goal
Make every deploy **intentional** — all conditions checked,
no obvious errors, and the user has confirmed.

> **Deploying the app ≠ releasing a version.** This skill covers deploying the current
> app state. A version **release** (tagging, `main`) is a separate, automated flow: merging
> to `develop` opens a Release PR via `.github/workflows/release-pr.yml`, and merging that PR
> to `main` cuts the tagged release via `.github/workflows/release-tag.yml`. Do not restate the
> release procedure here — the single source of truth is `docs/04-operations/OPERATIONS.md`
> §3 (リリース) and §4 (デプロイ).

---

## Step 1 — Required context

1. `git log develop..HEAD` / recent PRs — understand what is being shipped
2. Check whether `firestore.rules` or `firestore.indexes.json` changed since the last deploy — if so, they must be deployed too

---

## Step 2 — Pre-deploy checklist

Run in order and report the result of each item:

```
PRE-DEPLOY CHECKLIST
=====================
[ ] Build passes
    → Run: npm run build

[ ] No TypeScript errors
    → Run: npx tsc --noEmit

[ ] No leftover debug console.log
    → Search: grep -r "console.log" app/ components/

[ ] ENV variables complete
    → Ask the user to verify on the Vercel dashboard (the agent CANNOT read
      .env files — blocked by the block-env hook on purpose; never try to bypass it)

[ ] Firestore rules/indexes deployed if changed
    → firebase deploy --only firestore:rules,firestore:indexes

[ ] Tests pass
    → npm run verify

[ ] API endpoints work correctly
    → See docs/02-design/API.md, test the critical endpoints

[ ] No blocking TODO/FIXME
    → Search: grep -r "TODO\|FIXME" app/ --include="*.ts" --include="*.tsx"
```

---

## Step 3 — Status report

```
📊 DEPLOY READINESS REPORT
===========================
✅ Build: OK
✅ TypeScript: OK
⚠️  Console.log: 2 leftovers (app/cards/page.tsx:14, components/preview/DeckList.tsx:8)
✅ ENV: OK
❌ Blocking TODO: 1 (app/api/sync/route.ts:32 - "TODO: add rate limiting")

Conclusion: NOT READY — 1 blocking issue must be fixed
```

---

## Step 4 — Wait for confirmation

If everything is ✅:
> "Checklist passed. Do you want me to proceed with the deploy?"

If there is any ⚠️ or ❌:
> "There are [N] issues to review first. Do you want to fix them or deploy anyway?"

**NEVER deploy without explicit user confirmation.**

---

## Step 5 — After deploying

Suggest:
```
💡 Do you want me to update the relevant docs/ files for what was shipped?
```

---

## Hard rules

- Do **NOT** skip the checklist even if the user says "just deploy quickly"
- Do **NOT** run the deploy command without confirmation
- **MUST** list everything that did not pass — never hide warnings
- If there is a blocking issue → propose fixing it first, do not push through
