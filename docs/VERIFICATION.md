# VERIFICATION.md — ランタイム検証フレームワーク

> [anthropics/cwc-workshops — phase-3-verify](https://github.com/anthropics/cwc-workshops/tree/main/how-we-claude-code/phase-3-verify) を Next.js App Router + React 19 + zod 4 向けに移植・カスタマイズ。

## 設計思想

Verification は **表面でのランタイム観察** — React internals を読まず、snapshot test も行いません:

1. **Mount** — 固定 props (fixture) で実際のコンポーネントをマウント
2. **Act** — fixture が宣言していれば DOM 経由で操作 (click、type)
3. **Observe** — DOM とコンポーネント自身が発する contract `data-verify-*` を読み込み
4. **Check** — 独立した verifier がスコアリング
5. **Verdict** — `PASS | FAIL | BLOCKED | SKIP`

同じコードパス `runFixture()` (`verify/core/runner.ts`) が 3 つの consumer すべてに対応:

| Consumer | 実行方法 |
|---|---|
| **CI / ターミナル** | `npm run verify` (vitest + jsdom、`verify/matrix.test.ts` を実行) |
| **ダッシュボード** | `npm run dev` → `/verify` を開く → "Run all" ボタン |
| **エージェント** | Browser console: `window.__verify.manifest()` / `.current()` / `await window.__verify.runAll()` |

## 概念

- **VerifiableUnit** — `verify/specs/<kebab-case>.verify.tsx` ファイル内で `registerUnit()` を通じて登録される 1 つのコンポーネント/機能: `render`、`propsSchema` (zod)、`fixtures[]`、`invariants[]` から構成。
- **Fixture** — 再現可能な 1 つのレンダリング設定。`probe: true` は対抗的な fixture (edge case) を示す; **各 unit は ≥1 個の probe が必須** (matrix test で強制)。`act` は命令的な操作ステップ (`ctx.click/type/wait`)。
- **Invariant** — マウントされた DOM に対して真である必要がある predicate。`true` または違反を説明する文字列を返す。`onlyFixtures` は適用される fixture を制限。
- **Verifier** — 独立してプラグ可能な checker (`verify/verifiers/`): `schema` (props が zod と一致)、`invariants` (unit の predicate)、`dom-contract` (data-verify-* が存在 + 自己識別)、`a11y` (button に名前があるか、input に label があるか、img に alt があるか)。新しい verifier の追加 = ファイル追加 + `verifiers/index.ts` に import、コンポーネントは修正しない。
- **EXPECTED_FAIL** — `verify/matrix.test.ts` 内で意図的に FAIL する `unit::fixture` の集合 (probe が invariant に違反) で、フレームワークが実際のバグを捕捉できることを証明。この種の probe を追加する場合、この set に追加し、fixture の description に `(EXPECTED_FAIL)` という注記を付ける必要があります。

## DOM contract

spec を持つコンポーネントは `verifyAttrs()` をルート要素に spread する必要があります:

```tsx
import { verifyAttrs } from '@/verify/core/contract'

<span {...verifyAttrs({ unit: 'Badge', variant, removable: !!onRemove })}>
```

- Key `unit` は必須で、VerifiableUnit の `id` と一致する必要があります。
- `verifyAttrs()` は **`NODE_ENV=production` の場合 `{}` を返す** — 実際の HTML ビルドには contract attrs が含まれません。トレードオフ: production ビルドでは verify できない (確定した方針)。

## 新しい spec を書く

1. `verify/specs/<component-name>.verify.tsx` を作成:

```tsx
import type { ComponentProps } from 'react'
import { z } from 'zod'
import { MyComponent } from '@/components/ui/MyComponent'
import { registerUnit } from '@/verify/core/registry'
import { fn, reactNode } from '@/verify/core/schema-helpers'

registerUnit<ComponentProps<typeof MyComponent>>({
  id: 'MyComponent',
  title: 'MyComponent',
  kind: 'component',           // または 'feature'
  render: props => <MyComponent {...props} />,
  propsSchema: z.object({
    onChange: fn().optional(), // z.function() は使わない — zod 4 で API が変更された
    children: reactNode(),
  }),
  fixtures: [/* ≥1 fixture probe:true */],
  invariants: [/* DOM/contract に対する predicate */],
})
```

2. `verify/specs/index.ts` に side-effect import を追加。
3. コンポーネントのルート要素に `verifyAttrs({ unit: 'MyComponent', ...state })` を spread。
4. `npm run verify` を実行 — 新しい unit が自動的に matrix に表示されます。

注記:
- コンポーネントが条件付きで `null` をレンダリング (Modal が閉じている…) する場合 → `allowsEmptyRender: true` を宣言して、dom-contract verifier が FAIL ではなく **ok** (空の DOM は有効) と判定するようにします。SKIP は現在の環境で実行できない fixture 専用 (例 ブラウザ上の firestore)。
- callback のスパイ: module-scope の counter を使用し、**`act` 内でリセット** (fixtures は複数回実行される — dashboard、vitest)。

## Mocks 拡張 (オリジナル版との違い)

Fixture は `mocks` を宣言できます — runner がマウント前にインストールし、verify 後に復元:

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
| `fetch` | ✅ globalThis.fetch を入れ替え | ✅ |
| `firestore` | ✅ alias `firebase/firestore` 経由で in-memory stub → `verify/harness/firestore-stub.ts` (vitest.config.ts) | ❌ → fixture が **SKIP** を返す — vitest が信頼できる情報源 |
| `localStorage` | ✅ | ✅ |
| `pathname` | ✅ `verify/test-setup.ts` 内で `next/navigation` を mock | ❌ (実際の App Router) — pathname に依存する invariant は `onlyFixtures` で vitest 専用にする必要がある |

Firestore stub がサポートするのは: `where` equality/`in`、`orderBy` 1 フィールド、`getDocs/getDoc/addDoc/updateDoc/deleteDoc/serverTimestamp` のみ。他の API を使うコンポーネントは stub を追加する必要があります。

## コマンド

```bash
npm run verify         # matrix + unit tests 全体を実行 (CI パス)
npm run verify:watch   # ウォッチモード
```

ダッシュボード: `npm run dev` → `http://localhost:3000/verify`。孤立マウントルート: `/verify/<unitId>/<fixtureId>` (`?chrome=0` はスクリーンショット撮影用に結果フレームを非表示)。Production: 両方のルートが 404 を返す。

## 構造

```
verify/
  core/        types、contract (verifyAttrs/readContract)、registry、runner、schema-helpers
  verifiers/   schema、invariants、dom-contract、a11y (+index.ts side-effect imports)
  harness/     handle (window.__verify)、mock-fetch、firestore-stub、firebase-stub、Dashboard、UnitPage
  specs/       *.verify.tsx (+index.ts side-effect imports)
  unit/        lib/ client-safe 用の純粋な unit test (session、pendingEntry)
  matrix.test.ts
  test-setup.ts
app/verify/                          # dashboard (dev のみ)
app/verify/[unitId]/[fixtureId]/     # 孤立マウント (dev のみ)
vitest.config.ts
```

## 現在のカバレッジ & ロードマップ

- **Phase A (完了)** — framework + pilots: Badge、Button、ProgressBar、StepIndicator、Tabs + `lib/session.ts`、`lib/pendingEntry.ts` の unit tests。
- **Phase B (完了)** — 残りの ui/ + layout (17 units): AnkiFlowLogo、Card、EmptyState、ErrorMessage、FlowTip、StatCard、Toggle、TagInput、FilterBar、DataTable、Modal、LoadingOverlay、Input/Textarea/Select、PageHeader、ConnectedBadge (mock fetch)、NavigationSidebar (mock pathname)。
- **Phase C (完了)** — create/ + preview/ + history/ (18 units): selectors は `mocks.firestore` を使用; LanguageForm/ITForm/GeneralForm はフル mocks を使用 (firestore + fetch /api/generate + router + localStorage); CardPreview/WordDetailCard には "optional language fields" gotcha 用の probe あり。`next/image` は `verify/test-setup.ts` 内で `<img>` に mock。
- **Phase D (完了)** — admin/ managers (5 units、mocks.firestore CRUD: loaded/empty/create/toggle-active/probe) + feature spec `create-language-flow` (kind `feature`、end-to-end create→preview handoff)。`Card` は rest props を forward し、各 manager が自身の contract を識別。共有ヘルパー: `verify/specs/manager-helpers.ts`。
- **今後の作業** — hooks (useSession、usePreviewEntry、useAnkiExport) には renderHook tooling が必要; production ビルドでの verify (verifyAttrs の production-gate を外す必要あり)。
