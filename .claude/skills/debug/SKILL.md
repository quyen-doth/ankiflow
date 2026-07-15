---
name: debug
description: >
    Debug and fix errors in ankiflow. Use when: user mentions @debug,
    pastes an error message, describes unexpected behavior, asks "why doesn't X work",
    or reports unexpected output. Find the root cause before fixing.
---

# Skill: Debug

## When to use

Apply this skill at Step 6b of the mandatory workflow when Vitest or Playwright tests fail.

## Process

### 1. Identify failure type

| Symptom                  | Likely cause                                           |
| ------------------------ | ------------------------------------------------------ |
| TypeScript compile error | Type mismatch, missing import, wrong enum value        |
| Vitest assertion fail    | Logic error, wrong mock, incorrect expected value      |
| Playwright timeout       | Element not found, wrong selector, async timing issue  |
| Firestore error          | Wrong collection path, missing field, permission issue |
| AnkiConnect error        | Anki Desktop not open, malformed note payload          |

### 2. Reproduce locally

- Always reproduce the failure before attempting a fix
- For Playwright: run with `--headed` flag to observe browser behavior
- For Vitest: run with `--reporter=verbose` to see full output

### 3. Isolate the root cause

- Read the full stack trace — do not guess from the error message alone
- Check if the failure is in: application code, test code, or test setup
- If Firestore-related: re-read `docs/DATABASE.md` before changing anything

### 4. Fix

- Fix only the root cause — do not refactor unrelated code
- If the fix requires changing an API contract, re-read `docs/API.md`
- If the fix changes a Firestore schema field, update `docs/DATABASE.md`

### 5. Verify fix

- Re-run the failing test(s) first
- Then run full suite: `npm run verify`
- Then re-run Playwright tests
- All must pass before exiting the debug loop
