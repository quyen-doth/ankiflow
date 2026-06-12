# VERIFICATION.md — Framework kiểm thử runtime

> Port và tùy chỉnh từ [anthropics/cwc-workshops — phase-3-verify](https://github.com/anthropics/cwc-workshops/tree/main/how-we-claude-code/phase-3-verify) cho Next.js App Router + React 19 + zod 4.

## Triết lý

Verification là **quan sát runtime tại bề mặt** — không đọc React internals, không snapshot test:

1. **Mount** component thật với props cố định (fixture)
2. **Act** — tương tác qua DOM (click, type) nếu fixture khai báo
3. **Observe** — đọc DOM và contract `data-verify-*` mà component tự phát
4. **Check** — các verifier cắm rời chấm điểm
5. **Verdict** — `PASS | FAIL | BLOCKED | SKIP`

Cùng một code path `runFixture()` (`verify/core/runner.ts`) phục vụ cả 3 consumer:

| Consumer | Cách chạy |
|---|---|
| **CI / terminal** | `npm run verify` (vitest + jsdom, chạy `verify/matrix.test.ts`) |
| **Dashboard** | `npm run dev` → mở `/verify` → nút "Run all" |
| **Agent** | Browser console: `window.__verify.manifest()` / `.current()` / `await window.__verify.runAll()` |

## Khái niệm

- **VerifiableUnit** — một component/feature đăng ký qua `registerUnit()` trong file `verify/specs/<kebab-case>.verify.tsx`: gồm `render`, `propsSchema` (zod), `fixtures[]`, `invariants[]`.
- **Fixture** — một cấu hình render tái lập được. `probe: true` đánh dấu fixture đối kháng (edge case); **mỗi unit bắt buộc có ≥1 probe** (matrix test enforce). `act` là bước tương tác imperative (`ctx.click/type/wait`).
- **Invariant** — predicate phải đúng trên DOM đã mount. Trả `true` hoặc string mô tả vi phạm. `onlyFixtures` giới hạn fixture áp dụng.
- **Verifier** — checker độc lập, cắm rời (`verify/verifiers/`): `schema` (props khớp zod), `invariants` (predicate của unit), `dom-contract` (data-verify-* tồn tại + tự định danh), `a11y` (button có tên, input có label, img có alt). Thêm verifier mới = thêm file + import vào `verifiers/index.ts`, không sửa component.
- **EXPECTED_FAIL** — tập `unit::fixture` trong `verify/matrix.test.ts` cố tình FAIL (probe vi phạm invariant) để chứng minh framework bắt được lỗi thật. Khi thêm probe loại này phải thêm vào set, kèm chú thích `(EXPECTED_FAIL)` trong description của fixture.

## DOM contract

Component có spec phải spread `verifyAttrs()` vào element gốc:

```tsx
import { verifyAttrs } from '@/verify/core/contract'

<span {...verifyAttrs({ unit: 'Badge', variant, removable: !!onRemove })}>
```

- Key `unit` bắt buộc, phải bằng `id` của VerifiableUnit.
- `verifyAttrs()` **trả về `{}` khi `NODE_ENV=production`** — HTML build thật không chứa contract attrs. Đổi lại: không verify được trên production build (chính sách đã chốt).

## Viết spec mới

1. Tạo `verify/specs/<component-name>.verify.tsx`:

```tsx
import type { ComponentProps } from 'react'
import { z } from 'zod'
import { MyComponent } from '@/components/ui/MyComponent'
import { registerUnit } from '@/verify/core/registry'
import { fn, reactNode } from '@/verify/core/schema-helpers'

registerUnit<ComponentProps<typeof MyComponent>>({
  id: 'MyComponent',
  title: 'MyComponent',
  kind: 'component',           // hoặc 'feature'
  render: props => <MyComponent {...props} />,
  propsSchema: z.object({
    onChange: fn().optional(), // KHÔNG dùng z.function() — zod 4 đã đổi API
    children: reactNode(),
  }),
  fixtures: [/* ≥1 fixture probe:true */],
  invariants: [/* predicate trên DOM/contract */],
})
```

2. Thêm side-effect import vào `verify/specs/index.ts`.
3. Spread `verifyAttrs({ unit: 'MyComponent', ...state })` vào root element của component.
4. Chạy `npm run verify` — unit mới tự xuất hiện trong matrix.

Lưu ý:
- Component render `null` có điều kiện (Modal đóng…) → khai báo `allowsEmptyRender: true` để dom-contract verifier SKIP thay vì FAIL.
- Spy cho callback: dùng counter module-scope, **reset trong `act`** (fixtures chạy nhiều lần — dashboard, vitest).

## Mocks extension (khác bản gốc)

Fixture có thể khai báo `mocks` — runner cài trước khi mount, khôi phục sau verify:

```ts
mocks: {
  fetch: [{ match: '/api/generate', response: { status: 200, json: {...} } }],
  firestore: { decks: [{ id: 'd1', is_active: true, ... }] },
  localStorage: { ankiflow_pending_result: '...' },
  pathname: '/dashboard',
}
```

| Mock | vitest | Browser (/verify) |
|---|---|---|
| `fetch` | ✅ swap globalThis.fetch | ✅ |
| `firestore` | ✅ stub in-memory qua alias `firebase/firestore` → `verify/harness/firestore-stub.ts` (vitest.config.ts) | ❌ → fixture trả **SKIP** — vitest là source of truth |
| `localStorage` | ✅ | ✅ |
| `pathname` | ✅ mock `next/navigation` trong `verify/test-setup.ts` | ❌ (App Router thật) — invariant phụ thuộc pathname phải vitest-only qua `onlyFixtures` |

Firestore stub chỉ hỗ trợ: `where` equality/`in`, `orderBy` 1 field, `getDocs/getDoc/addDoc/updateDoc/deleteDoc/serverTimestamp`. Component dùng API khác → bổ sung stub.

## Lệnh

```bash
npm run verify         # chạy toàn bộ matrix + unit tests (CI path)
npm run verify:watch   # watch mode
```

Dashboard: `npm run dev` → `http://localhost:3000/verify`. Route mount cô lập: `/verify/<unitId>/<fixtureId>` (`?chrome=0` ẩn khung kết quả để chụp screenshot). Production: cả hai route trả 404.

## Cấu trúc

```
verify/
  core/        types, contract (verifyAttrs/readContract), registry, runner, schema-helpers
  verifiers/   schema, invariants, dom-contract, a11y (+index.ts side-effect imports)
  harness/     handle (window.__verify), mock-fetch, firestore-stub, firebase-stub, Dashboard, UnitPage
  specs/       *.verify.tsx (+index.ts side-effect imports)
  unit/        unit test thuần cho lib/ client-safe (session, pendingEntry)
  matrix.test.ts
  test-setup.ts
app/verify/                          # dashboard (dev-only)
app/verify/[unitId]/[fixtureId]/     # mount cô lập (dev-only)
vitest.config.ts
```

## Coverage hiện tại & roadmap

- **Phase A (xong)** — framework + pilots: Badge, Button, ProgressBar, StepIndicator, Tabs + unit tests cho `lib/session.ts`, `lib/pendingEntry.ts`.
- **Phase B** — ui/ còn lại + layout (17 units): AnkiFlowLogo, Card, EmptyState, ErrorMessage, FlowTip, StatCard, Toggle, TagInput, FilterBar, DataTable, Modal, LoadingOverlay, Input/Textarea/Select, PageHeader, ConnectedBadge (mock fetch), NavigationSidebar (mock pathname).
- **Phase C** — create/ + preview/ + history/ (18 units): selectors dùng `mocks.firestore`; LanguageForm/ITForm/GeneralForm dùng full mocks (firestore + fetch /api/generate + router + localStorage); CardPreview chú ý gotcha "optional language fields".
- **Phase D** — admin/ managers (5 units, mocks.firestore CRUD) + feature spec `create-language-flow`.
- **Future work** — hooks (useSession, usePreviewEntry, useAnkiExport) cần renderHook tooling; verify trên production build (đòi hỏi bỏ production-gate của verifyAttrs).
