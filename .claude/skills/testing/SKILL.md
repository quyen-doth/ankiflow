---
name: testing
description: >
    Test lỗi trong ankiflow. Dùng khi: user đề cập @testing
---

# Skill: Testing

## When to use

Apply this skill at Step 5 and Step 6a of the mandatory workflow.

## Vitest — Unit & Verification Tests

### Location

`ankiflow/verify/` — follow the spec format in `docs/VERIFICATION.md`

### Run commands

```bash
npm run verify          # Run all specs once
npm run verify:watch    # Watch mode during development
```

### What to test

- Every function with branching logic
- All FormType-dependent behavior (LANGUAGE / IT / GENERAL)
- All Firestore read/write helpers
- All AI agent tool calls (mock the Anthropic SDK)
- Enum usage — never test with raw string literals

### What NOT to test

- Next.js framework internals
- Firebase SDK internals
- Third-party API responses (mock them instead)

### Mock conventions

- Mock `firebase-admin` at module level, not inside individual tests
- Mock Anthropic SDK responses as tool-use blocks matching the real schema
- Use `vi.mock()` — never mutate globals directly

---

## Playwright — E2E Tests

### Setup assumption

Dev server must be running at `localhost:3000` before Playwright runs.
AnkiConnect is NOT assumed to be available — mock or skip AnkiConnect-dependent flows.

### What to test

- Full Create → Preview flow per FormType
- History page: list, detail view
- Admin CRUD flows (with `x-api-secret` header set in test config)
- Settings page: toggle states persist after reload

### What NOT to test

- Actual Anki export (requires live AnkiConnect — too brittle for CI)
- Unsplash/TTS API calls (mock at network level with Playwright route interception)

### Selectors

- Prefer `data-testid` attributes over CSS selectors or text content
- If a `data-testid` is missing, add it to the component before writing the test

### On failure

- Run with `--headed` to observe the browser
- Check browser console for JS errors before inspecting selectors
- If timeout: check if the element is conditionally rendered based on state
