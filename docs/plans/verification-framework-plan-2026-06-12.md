# Plan: Runtime Verification Framework cho AnkiFlow

> Ngày lập: 2026-06-12 · Nguồn framework: [anthropics/cwc-workshops — phase-3-verify](https://github.com/anthropics/cwc-workshops/tree/main/how-we-claude-code/phase-3-verify)
> Hướng dẫn sử dụng/viết spec: `docs/VERIFICATION.md` · Checklist tiến độ: `docs/tasks.md` PHASE 6

## 1. Context

AnkiFlow trước 2026-06-12 có **zero test**. Nhiệm vụ: copy và tùy chỉnh framework runtime verification từ `phase-3-verify` vào dự án, kèm spec coverage cho toàn bộ ~46 component, chia 4 phase có gate nghiệm thu.

Nguyên lý framework: **mount component thật → tương tác (act) → quan sát DOM qua contract `data-verify-*` → verifiers chấm verdict** (`PASS | FAIL | BLOCKED | SKIP`). Một code path `runFixture()` duy nhất phục vụ 3 consumer: dashboard `/verify`, agent handle `window.__verify`, CI (`npm run verify` — vitest matrix).

Khác biệt môi trường phải xử lý khi port:

| Framework gốc | AnkiFlow | Cách xử lý |
|---|---|---|
| Vite + React Router | Next.js 16 App Router | Routes client component `app/verify/page.tsx` + `app/verify/[unitId]/[fixtureId]/page.tsx`, guard `notFound()` ở production |
| React 18 | React 19 | Runner flush bằng macrotask thật, không dùng `act()` |
| zod 3 (`z.function()`) | zod 4 | Helper `fn()` = `z.custom<T>(v => typeof v === 'function')` trong `verify/core/schema-helpers.ts` |
| Components thuần props | Nhiều component fetch Firestore client/fetch API khi mount | **Mocks extension** (mục 4) |

Quyết định đã chốt với user:
1. Triển khai **Phase A, B trước**, nghiệm thu rồi mới C→D.
2. Instrument mọi component có spec bằng `verifyAttrs()` — trả `{}` khi `NODE_ENV=production` (HTML production sạch).
3. Được phép sửa docs: `docs/VERIFICATION.md`, `docs/tasks.md`, `CLAUDE.md`.

Out of scope: ReplayPage / recorder / Playwright video của bản gốc; hooks tests (cần renderHook tooling — future work).

## 2. Kiến trúc đã triển khai (Phase B — hoàn thành 2026-06-12)

```
verify/
  core/
    types.ts            # Verdict, Check, Fixture (+mocks), Invariant, VerifiableUnit (+allowsEmptyRender), VerifyResult, VerifyHandle
    contract.ts         # verifyAttrs() — {} khi production; readContract()
    registry.ts         # registerUnit (ghi đè theo id — HMR safe) / registerVerifier / allUnits / buildManifest
    runner.ts           # runFixture(): install mocks → mount (createRoot) → act → verifiers → verdict → cleanup
    schema-helpers.ts   # fn(), reactNode() cho zod 4
    globals.ts          # typed accessor cho global hooks (firestore seed, nav mock, __verify)
  verifiers/
    schema.ts           # zod safeParse props (zod 4: error.issues)
    invariants.ts       # predicates của unit, tôn trọng onlyFixtures
    dom-contract.ts     # data-verify-unit hiện diện + tự định danh; SKIP nếu allowsEmptyRender + DOM rỗng
    a11y.ts             # button có tên, input có label, img có alt
    index.ts            # side-effect imports
  harness/
    handle.ts           # window.__verify { manifest, current, runAll } + setCurrentResult
    mock-fetch.ts       # swap globalThis.fetch theo FetchRule[]; unmatched → 501
    firestore-stub.ts   # vitest-only (alias): in-memory collection/query/where(==,in)/orderBy/getDocs/getDoc/addDoc/updateDoc/deleteDoc/serverTimestamp/Timestamp
    firebase-stub.ts    # vitest-only (alias): db giả
    Dashboard.tsx       # /verify — Run all + verdict grid + links + manifest
    UnitPage.tsx        # /verify/[unitId]/[fixtureId] — mount cô lập, ?chrome=0
  specs/                # *.verify.tsx (kebab-case) + index.ts side-effect imports
  unit/                 # unit tests thuần: session.test.ts, pending-entry.test.ts
  matrix.test.ts        # mọi unit×fixture PASS (trừ EXPECTED_FAIL); enforce ≥1 probe/unit
  test-setup.ts         # vi.mock next/navigation, Audio stub, localStorage.clear()
app/verify/page.tsx                       # dashboard (dev-only, production → 404)
app/verify/[unitId]/[fixtureId]/page.tsx  # mount cô lập (Suspense cho useSearchParams)
vitest.config.ts                          # jsdom + alias: firebase/firestore → firestore-stub, @/lib/firebase → firebase-stub, @ → root
```

devDeps đã thêm: `vitest@^4.1.8`, `jsdom@^29.1.1`, `@vitejs/plugin-react@^6.0.2`. Scripts: `verify` (vitest run), `verify:watch`.

### Quy ước viết spec (tóm tắt — chi tiết xem docs/VERIFICATION.md)

- 1 file `verify/specs/<kebab>.verify.tsx` / unit; đăng ký qua `registerUnit<ComponentProps<typeof X>>`; thêm import vào `specs/index.ts`.
- Mỗi unit **bắt buộc ≥1 fixture `probe: true`** (matrix enforce).
- Probe cố tình vi phạm invariant → thêm vào `EXPECTED_FAIL` trong `matrix.test.ts`, ghi `(EXPECTED_FAIL)` trong description.
- Spy callback: counter module-scope, **reset trong `act`**.
- Component render `null` có điều kiện → `allowsEmptyRender: true`.
- Component được spec phải spread `{...verifyAttrs({ unit: '<id>', ...state })}` vào element gốc.

## 3. Verdict & ba đường chạy

- `npm run verify` — CI path, source of truth (firestore stub active).
- `/verify` dashboard (dev) — Run all + click từng fixture; fixture có `mocks.firestore` → **SKIP** trên browser.
- `window.__verify` — `manifest()` / `current()` / `await runAll()` cho agent.

Verdict: `BLOCKED` (exception khi mount/act) > `FAIL` (≥1 check fail) > `SKIP` (≥1 check skip, không fail) > `PASS`.

## 4. Mocks extension

```ts
fixture.mocks?: {
  fetch?: FetchRule[]                    // { match: string|RegExp, response: { status?, json?, delayMs?, reject? } }
  firestore?: Record<string, DocSeed[]>  // collection → docs; CHỈ vitest (alias), browser → SKIP
  localStorage?: Record<string, string>  // seed trước mount, xóa sau verify
  pathname?: string                      // mock next/navigation (CHỈ vitest)
}
```

Runner: install trước mount → restore trong `finally` (kể cả keepMounted). Invariant phụ thuộc `pathname`/router calls phải vitest-only (dùng `onlyFixtures` + fixture có mocks); đọc lời gọi router qua `globalThis.__verifyNav.calls`.

## 5. Phase A — ✅ hoàn thành & nghiệm thu 2026-06-12

5 pilot specs + instrument: **Badge, Button, ProgressBar, StepIndicator, Tabs**. Unit tests: `lib/session.ts`, `lib/pendingEntry.ts`.

`EXPECTED_FAIL` hiện tại: `Badge::probe-empty-label`, `Tabs::probe-active-not-in-list`.

Kết quả: `npm run verify` 44/44 ✅ · lint ✅ · build ✅ · dev `/verify` 200 ✅ · production `/verify` 404 + HTML không có `data-verify-*` ✅.

## 6. Phase B — ✅ hoàn thành & nghiệm thu 2026-06-12

Mỗi dòng: contract keys → fixtures (P = probe) → invariants chính.

| Unit | Contract keys | Fixtures | Invariants chính |
|---|---|---|---|
| AnkiFlowLogo | unit, size | default; sm; with-href; P empty-href | render link iff href; có svg |
| Card | unit | default; nested-content; P empty-children | children render bên trong root |
| EmptyState | unit, hasAction | title-only; full (icon+desc+action); P empty-title **(EF)** | title render; action iff prop |
| ErrorMessage | unit (allowsEmptyRender) | with-message; null-message; P long-message | message hiển thị; render null khi message null |
| FlowTip | unit, label | default-label; custom-label; P empty-children | label + children render |
| StatCard | unit | basic; with-delta-icon; P numeric-zero | label/value render; delta iff prop |
| Toggle | unit, checked, disabled | off; on; disabled; act-toggle (click → onChange(!checked)); P click-disabled (spy = 0) | role=switch/aria-checked khớp; label gắn đúng; disabled inert |
| TagInput | unit, count, max | empty; with-tags; act-add-tag (type+Enter → onChange thêm); act-remove-tag; P at-max (add inert) | đúng số chip; nút remove có tên; max được tôn trọng |
| FilterBar | unit, activeCount | search-only; with-active-filters; act-search (type → onSearchChange); P clear-all | input có label/placeholder; chip removable; clear-all iff handler+chips |
| DataTable | unit, rows, cols | populated; empty (emptyMessage); custom-render; act-row-click; P empty-columns **(EF)** | thead khớp columns; tbody rows = data.length; empty message iff không data; row click fires |
| Modal | unit, open, size (allowsEmptyRender) | closed; open-basic; open-with-title; act-close-button → onClose; P no-title | DOM rỗng khi closed; title render; close fires onClose 1 lần |
| LoadingOverlay | unit, open, progress (allowsEmptyRender) | closed; mid-progress (steps+tip); complete; P progress-overflow | render iff open; progressbar khớp; steps render |
| Input | unit, error | default; with-error; act-type (value → onChange); P unlabeled **(EF qua a11y)** | error style/message iff error; có label |
| Textarea | unit, error | default; with-error; P unlabeled **(EF)** | như Input |
| Select | unit, error | with-options; with-error; act-change; P no-options | options render; change fires |
| PageHeader | unit, crumbs | title-only; with-crumbs-desc-actions; P empty-crumbs | title đúng cấp heading; số crumb link; actions slot |
| ConnectedBadge | unit, connected | prop-connected; prop-disconnected; polled-ok (mocks.fetch 200); polled-down (mock 500); P fetch-throws (reject → offline) | text trạng thái khớp; không chạm network thật |
| NavigationSidebar | unit, active | dashboard-active (mocks.pathname + mocks.fetch); create-active; P unknown-path | đủ nav links + href; active style khớp pathname (vitest-only); logo hiện diện |

Ghi chú: Input/Textarea/Select (+FieldWrapper) đăng ký từ một file `form-field.verify.tsx`. Fixtures phải khớp props thật trong code — kiểm tra component trước khi viết, bảng trên là định hướng.

## 7. Phase C — ✅ hoàn thành 2026-06-13 — create/ + preview/ + history/ (18 units)

> Kết quả: 18 specs + instrument xong, `npm run verify` 232/232 ✅ · lint ✅ · build ✅.
> Điều chỉnh so với kế hoạch:
> - `EXPECTED_FAIL` mới: chỉ `SectionDivider::probe-empty-label` (Input/Textarea unlabeled đã có từ Phase B; probe form rỗng đổi thành kiểm tra `onValidityChange(false)` vì form không tự validate — nút submit do page disable).
> - `FieldWrapper` nhận rest props để selector spread `verifyAttrs` vào root; thêm `aria-label` cho các Select/input nội bộ (sửa a11y thật).
> - `verify/test-setup.ts` mock `next/image` → `<img>` thuần (ImageSelector).
> - Sửa `dom-contract`: DOM rỗng + `allowsEmptyRender` chấm `ok` thay vì `skip` (skip lan lên verdict SKIP làm fail matrix — lộ ra khi cài lại node_modules; SKIP nay chỉ dành cho fixture không chạy được ở môi trường hiện tại).

**Thuần props:** SectionDivider (P empty-label EF nếu hợp lý), SmartEnrichmentBanner, LanguageSelector (option theo enum `LanguageType` — không hardcode), EditableField (act-enter-edit-save/cancel), CollocationEditor (act-add/remove), CardList (act-toggle), ImageSelector (a11y alt; act-select/refetch), CardPreview (**P minimal-entry** — gotcha "optional language fields": pinyin/hiragana/ipa chỉ render khi có), AudioPlayer (Audio stub trong test-setup; act-play → stub nhận url; null-url không crash), HistoryTable (status dùng enum; act-delete), WordDetailCard (P minimal-entry).

**mocks.firestore:** DeckSelector, CategorySelector, TopicSelector, CardTypeSelector — fixtures: loaded / empty / act-select-toggle / P inactive-hoặc-mismatched-formtype bị filter. Invariants: chỉ `is_active`, filter theo `FormType` enum, sort theo `sort_order`.

**Full mocks (firestore + fetch /api/generate + router + localStorage):** LanguageForm, ITForm, GeneralForm — fixtures: initial; filled; act-submit-success (mock 200 → assert `ankiflow_pending_result` lưu đúng + `router.push('/preview')` qua `__verifyNav.calls`); act-submit-api-error (mock 500 → lỗi hiển thị, không redirect, localStorage sạch); P empty-required-field (validation chặn submit).

## 8. Phase D — admin/ + feature spec (6 units)

5 managers (CategoryManager, CardTypeManager, TopicManager, DeckManager, ContentTypeManager): mocks.firestore; fixtures: loaded / empty / act-open-create-modal / act-create (điền modal → save → stub store nhận doc, bảng re-render) / act-toggle-active / P seed-thiếu-field-optional. Invariants: số row khớp store; modal mở/đóng; addDoc/updateDoc nhận giá trị enum đúng.

Feature spec `create-language-flow` (kind: `feature`): mount LanguageForm full mocks → điền từ → submit → assert localStorage `ankiflow_pending_result` khớp payload mock + router.push('/preview'); probe: API 500 → localStorage sạch.

## 9. Trình tự & nghiệm thu mỗi phase

Mỗi phase: (1) đọc code component trước khi viết spec — bảng trên là định hướng, props thật là chân lý; (2) instrument `verifyAttrs`; (3) viết spec + thêm vào `specs/index.ts`; (4) cập nhật `EXPECTED_FAIL` nếu có probe EF; (5) chạy `npm run verify` + `npm run lint` + `npm run build`; (6) tick checklist `docs/tasks.md` PHASE 6; (7) báo user nghiệm thu trước khi sang phase kế.

## 10. Rủi ro & lưu ý môi trường

- **React act() warning** trong vitest: runner không dùng act() — nếu xuất hiện warning noise thì lọc trong test-setup (cosmetic, không ảnh hưởng verdict).
- **Firestore stub fidelity**: chỉ equality/`in` where + orderBy 1 field; component dùng API khác → bổ sung stub trước.
- **Browser dashboard SKIP** mọi fixture firestore — vitest là source of truth cho các unit đó.
- **npm install trên máy này** có thể fail `SELF_SIGNED_CERT_IN_CHAIN` (Netskope chặn TLS theo process node/npm). Fix: `security find-certificate -a -p /Library/Keychains/System.keychain > /tmp/cas.pem` rồi `NODE_EXTRA_CA_CERTS=/tmp/cas.pem npm install ...`. Không tắt strict-ssl.
- **jsdom hazards** đã rà: không component nào dùng matchMedia/ResizeObserver; AudioPlayer cần Audio stub (đã có trong test-setup); Modal không dùng portal.
