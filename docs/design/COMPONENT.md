# AnkiFlow — Component Library

> **Mục đích:** File này là spec tham chiếu cho các UI primitive đã có trong codebase. Trước khi viết bất kỳ component nào, đọc `DESIGN.md` để hiểu token hệ thống, sau đó dùng spec này để tái sử dụng đúng pattern.
>
> **Stack:** Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS v4 (`@theme` trong `app/globals.css` — không có `tailwind.config.ts`)

---

## Quy ước toàn file

- Shared primitives: `components/ui/`. Layout: `components/layout/`. Feature-specific: `components/[feature]/` (vd. `components/admin/`, `components/preview/`, `components/history/`, `components/create/`).
- Client component (`'use client'`) chỉ khi có state, event handler, hoặc browser API. Server component là default.
- `cn()` — helper merge class trong `lib/utils.ts` (`clsx` + `tailwind-merge`).
- Tất cả icon dùng `lucide-react` — không dùng emoji hay custom SVG inline.
- **Mọi UI copy hiển thị cho người dùng phải là tiếng Anh** (xem `DESIGN.md` mục 2) — không hardcode chuỗi tiếng Việt, kể cả trong `alert()` / `console.error` mà người dùng có thể nhìn thấy gián tiếp.
- Mọi phần tử tương tác bắt buộc có `focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40` — cấm `focus:ring-0`.

---

## Index

1. [AnkiFlowLogo](#1-ankiflowlogo)
2. [Button](#2-button)
3. [Badge / Chip](#3-badge--chip)
4. [Card](#4-card)
5. [NavigationSidebar](#5-navigationsidebar)
6. [PageHeader](#6-pageheader)
7. [StatCard](#7-statcard)
8. [Input / Textarea / Select / FieldWrapper](#8-input--textarea--select--fieldwrapper)
9. [Toggle (Switch)](#9-toggle-switch)
10. [Tabs](#10-tabs)
11. [EmptyState](#11-emptystate)
12. [ErrorMessage](#12-errormessage)
13. [Modal / Dialog](#13-modal--dialog)
14. [DataTable](#14-datatable)
15. [FilterBar](#15-filterbar)
16. [TagInput](#16-taginput)
17. [ProgressBar](#17-progressbar)
18. [StepIndicator](#18-stepindicator)
19. [FlowTip](#19-flowtip)
20. [LoadingOverlay](#20-loadingoverlay)
21. [ConnectedBadge](#21-connectedbadge)
22. [CardPreview](#22-cardpreview)
23. [WordDetailCard](#23-worddetailcard)

---

## 1. AnkiFlowLogo

**Vị trí:** `components/ui/AnkiFlowLogo.tsx` · **Type:** Server Component
**Quy tắc:** nguồn sự thật duy nhất cho brand mark — không render logo inline ở nơi khác.

```tsx
interface AnkiFlowLogoProps {
  href?: string          // default '/dashboard'
  className?: string
  size?: 'sm' | 'md'     // 'sm' dùng cho mobile top bar, 'md' cho sidebar desktop
}
```

- Icon: vòng tròn `bg-primary text-on-primary` chứa `<Sparkles>`.
- Text: "AnkiFlow" (`font-serif font-bold text-primary`) + tagline "Cognitive Sanctuary" (`text-label-sm uppercase tracking-[0.12em] text-on-surface-var`) — dùng token `text-label-sm`, **không** `text-[9px]` tùy tiện.

**Usage:**
```tsx
<AnkiFlowLogo />            // sidebar desktop
<AnkiFlowLogo size="sm" />  // top bar mobile
```

---

## 2. Button

**Vị trí:** `components/ui/Button.tsx` · **Type:** Client Component (`forwardRef`)

```tsx
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'  // default 'primary'
  size?: 'sm' | 'md' | 'lg' | 'xl'                              // default 'md'
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}
```

| Variant | Class pattern |
|---|---|
| `primary` | `bg-primary text-on-primary hover:bg-primary-container active:scale-[0.98]` |
| `secondary` | `bg-primary/10 text-primary hover:bg-primary/15 active:scale-[0.98]` |
| `ghost` | `border border-outline-var text-on-surface-var hover:bg-surface-container active:scale-[0.98]` |
| `destructive` | `bg-error-container text-on-error border border-error/20 hover:bg-error hover:text-white active:scale-[0.98]` |

| Size | Class pattern |
|---|---|
| `sm` | `px-3.5 py-1.5 text-label-sm gap-1.5` |
| `md` | `px-5 py-2.5 text-label-lg gap-2` |
| `lg` | `px-6 py-3 text-base gap-2` |
| `xl` | `px-10 py-4 text-base gap-2` — dùng cho **1 CTA "hero" mỗi trang** (vd. nút Generate) |

Base: `inline-flex items-center justify-center rounded-full font-bold transition-all duration-150`, focus ring `focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-app-bg`, `loading` hiển thị `<Loader2 className="animate-spin" />` thay `leftIcon`.

> ❌ Không dùng FAB. Không viết nút inline trong form — luôn dùng `<Button>`.

**Usage:**
```tsx
<Button variant="primary" size="xl" onClick={handleGenerate}>Generate</Button>
<Button variant="ghost" leftIcon={<ArrowLeft className="w-4 h-4" />}>Back</Button>
<Button variant="destructive" loading={isDeleting}>Delete</Button>
```

---

## 3. Badge / Chip

**Vị trí:** `components/ui/Badge.tsx` · **Type:** Server Component

```tsx
type BadgeVariant = 'neutral' | 'active' | 'inactive' | 'pending' | 'ai' | 'language' | 'level'

interface BadgeProps {
  variant?: BadgeVariant   // default 'neutral'
  children: React.ReactNode
  className?: string
  onRemove?: () => void    // nếu có → hiển thị nút × để remove
}
```

| Variant | Class |
|---|---|
| `neutral` | `bg-surface-high text-on-surface-var` |
| `active` / `language` | `bg-primary/10 text-primary` |
| `inactive` | `bg-error-container text-on-error` |
| `pending` / `ai` | `bg-tertiary-fixed text-on-tertiary-fixed` |
| `level` | `bg-surface-high text-on-surface-var border border-outline-var/40` |

Base: `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium`.

**Usage:**
```tsx
<Badge variant="active">Active</Badge>
<Badge variant="language">Japanese</Badge>
<Badge onRemove={() => removeTag('Noun')}>Noun</Badge>
```

---

## 4. Card

**Vị trí:** `components/ui/Card.tsx` · **Type:** Server Component

```tsx
interface CardProps {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn('bg-white rounded-xl shadow-card border border-outline-var/40 p-6', className)}>
      {children}
    </div>
  )
}
```

Primitive đơn giản, dùng làm khung cho mọi section/panel/manager. Truyền `className` để override padding (`p-4` cho compact) hoặc thêm layout (`flex flex-col gap-4`…).

**Usage:**
```tsx
<Card>
  <h2 className="text-label-lg font-semibold text-on-surface-var mb-4">Categories</h2>
  <DataTable ... />
</Card>
```

---

## 5. NavigationSidebar

**Vị trí:** `components/layout/NavigationSidebar.tsx` · **Type:** Client Component (responsive drawer)

Responsive theo 2 chế độ — xem `DESIGN.md` mục 5 & 8 cho rationale đầy đủ:

```tsx
const navItems = [
  { label: 'Dashboard',   href: '/dashboard',   icon: LayoutDashboard },
  { label: 'Create Card', href: '/create',       icon: PlusCircle },
  { label: 'History',     href: '/history',      icon: History },
  { label: 'Admin',       href: '/admin',        icon: Shield },
  { label: 'Settings',    href: '/settings',     icon: Settings },
] as const

export function NavigationSidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [lastPathname, setLastPathname] = useState(pathname)

  // Đóng drawer khi đổi route — "adjust state during render", KHÔNG dùng useEffect
  // (tránh lỗi lint react-hooks/set-state-in-effect)
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setMobileOpen(false)
  }

  return (
    <>
      {/* Mobile top bar — chỉ hiện dưới md */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 h-16 flex items-center justify-between px-4 bg-surface-low border-b border-outline-var">
        <AnkiFlowLogo size="sm" />
        <button onClick={() => setMobileOpen(true)} aria-label="Open navigation menu" className="p-2 rounded-md ...">
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Backdrop — chỉ khi drawer mở trên mobile */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-inverse-surface/40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar / Drawer */}
      <aside className={cn(
        'w-64 h-screen bg-surface-low flex flex-col py-6 fixed left-0 top-0 z-50 border-r border-outline-var',
        'transition-transform duration-200 md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="px-4 py-2 mb-10 flex items-center justify-between">
          <AnkiFlowLogo />
          <button onClick={() => setMobileOpen(false)} aria-label="Close navigation menu" className="md:hidden p-2 ...">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 flex flex-col gap-1 px-3">
          {/* nav items — active: bg-primary/10 text-primary font-bold */}
        </nav>
        <div className="mt-auto px-3 pb-2">
          <ConnectedBadge />
        </div>
      </aside>
    </>
  )
}
```

Layout (`app/layout.tsx`) phải khớp offset:
```tsx
<main className="flex-1 min-h-screen pt-16 px-4 py-6 md:ml-64 md:pt-8 md:px-8 md:py-8 md:max-w-[calc(100vw-256px)]">
```

> ❌ **Cấm:** active nav item `bg-primary text-white` — luôn dùng tonal `bg-primary/10 text-primary font-bold`.

---

## 6. PageHeader

**Vị trí:** `components/layout/PageHeader.tsx` · **Type:** Server Component

```tsx
interface Crumb { label: string; href?: string }

interface PageHeaderProps {
  title?: string          // override breadcrumb cuối thành tiêu đề serif
  crumbs?: Crumb[]
  description?: string
  actions?: React.ReactNode
  className?: string
}
```

- Breadcrumb: icon `<Home>` link `/dashboard` → `›` → các crumb. Crumb cuối: `text-primary font-bold`. **Separator luôn `›`.**
- Title: `font-serif text-headline-md text-on-surface`. Description: `text-body-md text-on-surface-var`.
- `actions` căn phải, `flex items-center gap-3`.

**Usage:**
```tsx
<PageHeader
  crumbs={[{ label: 'Create Card', href: '/create' }, { label: 'Language Flow' }]}
/>

<PageHeader
  crumbs={[{ label: 'Admin' }]}
  title="Admin"
  description="Manage the configuration data that powers the Create flow"
/>
```

---

## 7. StatCard

**Vị trí:** `components/ui/StatCard.tsx` · **Type:** Server Component
**Dùng trong:** Dashboard stat grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`)

```tsx
interface StatCardProps {
  label: string
  value: string | number
  delta?: string
  icon?: React.ReactNode
  className?: string
}

export function StatCard({ label, value, delta, icon, className }: StatCardProps) {
  return (
    <div className={cn('bg-white rounded-xl shadow-card border border-outline-var/40 p-6', className)}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <p className="text-label-sm uppercase tracking-wide text-on-surface-var">{label}</p>
        {icon && <span className="text-on-surface-var flex-shrink-0">{icon}</span>}
      </div>
      <p className="text-display font-serif text-on-surface">{value}</p>
      {delta && <p className="text-label-sm text-on-surface-var mt-1">{delta}</p>}
    </div>
  )
}
```

> ⚠️ **Lưu ý quan trọng:** dùng `items-start` (không `items-center`) + `gap-3` + `flex-shrink-0` trên icon. Nhãn 2 từ viết hoa (vd. "TOTAL VOCABULARY") có thể wrap 2 dòng — `items-center` sẽ khiến icon đè lên dòng thứ hai.

**Usage:**
```tsx
<StatCard label="Total Vocabulary" value={1240} icon={<BookOpen className="w-4 h-4" />} />
<StatCard label="Synced to Anki" value="0%" icon={<CheckCircle className="w-4 h-4" />} />
```

---

## 8. Input / Textarea / Select / FieldWrapper

**Vị trí:** `components/ui/FormField.tsx` · **Type:** Client Component (`forwardRef`)

```tsx
export function FieldWrapper({ label, error, className, children }: FieldWrapperProps) // label + error helper
export const Input = forwardRef<HTMLInputElement, InputProps>(...)
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(...)
export const Select = forwardRef<HTMLSelectElement, SelectProps>(...)  // có ChevronDown overlay
```

Style chung — **1 style hợp nhất cho cả 3**:
```
bg-surface-container rounded-lg px-4 py-3 text-body-md text-on-surface
border border-transparent
focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
transition-shadow duration-150
```
- `error` prop → `ring-2 ring-error/50` (input/textarea) hoặc `border-error ring-2 ring-error/30` (select).
- `FieldWrapper`: label `text-label-sm uppercase tracking-wide text-on-surface-var`, error `text-label-sm text-error`.

**Usage:**
```tsx
<FieldWrapper label="Vocabulary Item">
  <Input value={value} onChange={...} placeholder="e.g. 蘸" />
</FieldWrapper>
<Select value={lang} onChange={...}>
  <option value="zh">Chinese</option>
</Select>
```

---

## 9. Toggle (Switch)

**Vị trí:** `components/ui/Toggle.tsx` · **Type:** Client Component

```tsx
interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}
```

Container `flex items-center justify-between py-4 px-5 bg-white rounded-lg border border-outline-var/40`. Track `w-11 h-6 rounded-full` (`bg-primary` khi `checked`, `bg-outline-var` khi tắt); thumb `w-5 h-5 bg-white rounded-full shadow translate-x-5` khi bật / `translate-x-0.5` khi tắt. `role="switch"` + `aria-checked` + focus ring.

**Usage:**
```tsx
<Toggle
  label="Required"
  description="The user must fill in this field before submitting"
  checked={field.is_required}
  onChange={(v) => updateField(index, 'is_required', v)}
/>
```

---

## 10. Tabs

**Vị trí:** `components/ui/Tabs.tsx` · **Type:** Client Component

```tsx
interface Tab { id: string; label: string }
interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (id: string) => void
  className?: string
}
```

Container: `flex flex-wrap gap-1 bg-surface-low rounded-lg p-1` (`role="tablist"`). Mỗi tab: `flex-1 whitespace-nowrap text-label-sm font-bold py-1.5 px-3 rounded-md transition-colors`; active `bg-white text-primary shadow-card`, inactive `text-on-surface-var hover:text-on-surface`. Focus ring + `role="tab"` / `aria-selected`.

> ⚠️ **`flex-wrap` là bắt buộc** — Admin có 5 tab với nhãn 2 từ ("Card Types", "Content Types"); thiếu `flex-wrap` sẽ gây tràn/đè chữ trên màn hẹp.

**Usage:**
```tsx
<Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} className="self-start" />
```

---

## 11. EmptyState

**Vị trí:** `components/ui/EmptyState.tsx` · **Type:** Server Component

```tsx
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}
```

Layout: `flex flex-col items-center justify-center text-center py-12 px-6`. Icon trong vòng tròn `w-12 h-12 rounded-full bg-surface-container`. Title `text-label-lg font-semibold`. Description `text-sm text-on-surface-var max-w-sm`.

**Usage:**
```tsx
<EmptyState
  icon={<Inbox className="w-5 h-5" />}
  title="No cards yet"
  description="Create your first vocabulary card to see it appear here."
  action={<Button onClick={() => router.push('/create')}>Create a card</Button>}
/>
```

---

## 12. ErrorMessage

**Vị trí:** `components/ui/ErrorMessage.tsx` · **Type:** Server Component

```tsx
interface ErrorMessageProps { message: string | null }

export function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) return null
  return (
    <div className="mb-4 px-4 py-3 bg-error-container border border-error/30 rounded-xl text-sm text-on-error">
      ⚠️ {message}
    </div>
  )
}
```

**Usage:**
```tsx
<ErrorMessage message={error} />
```

---

## 13. Modal / Dialog

**Vị trí:** `components/ui/Modal.tsx` · **Type:** Client Component

```tsx
interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'   // max-w-sm | max-w-lg | max-w-2xl
  className?: string
}
```

- Backdrop: `fixed inset-0 z-50` + `rgba(24,28,27,0.4)` + `backdrop-blur(4px)`; click ra ngoài để đóng; `Escape` để đóng.
- Container: `bg-white rounded-xl shadow-modal flex flex-col`.
- Header (nếu có `title`): tonal `bg-surface-container rounded-t-xl`, tiêu đề `font-serif text-headline-sm`, nút đóng `<X>`.
- Body: `p-6 flex-1 overflow-y-auto`. Với form dài (vd. ContentType field editor), bọc nội dung trong `max-h-[60vh] overflow-y-auto` để cuộn trong modal thay vì tràn trang.

**Usage:**
```tsx
<Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Edit Category" size="md">
  <FieldWrapper label="Name"><Input ... /></FieldWrapper>
  <div className="flex gap-3 justify-end mt-4">
    <Button variant="ghost" onClick={...}>Cancel</Button>
    <Button variant="primary" onClick={handleSave}>Save</Button>
  </div>
</Modal>
```

---

## 14. DataTable

**Vị trí:** `components/ui/DataTable.tsx` · **Type:** Client Component (generic `<T extends object>`)

```tsx
interface Column<T> {
  key: keyof T | string
  header: string
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (value: unknown, row: T) => React.ReactNode
}

interface DataTableProps<T extends object> {
  data: T[]
  columns: Column<T>[]
  onRowClick?: (row: T) => void
  keyField?: keyof T
  emptyMessage?: string
  className?: string
}
```

Header: `text-label-sm uppercase tracking-wide text-on-surface-var font-semibold`. Row: `border-b border-outline-var/30`, `hover:bg-surface-container/50` nếu có `onRowClick`. Empty state: 1 hàng `colSpan` đầy đủ với `emptyMessage`.

**Usage:**
```tsx
<DataTable
  data={categories}
  columns={[
    { key: 'name', header: 'Name', render: (_, row) => <span className="font-semibold">{row.name}</span> },
    { key: 'is_active', header: 'Status', render: (_, row) => <Badge variant={row.is_active ? 'active' : 'inactive'}>{row.is_active ? 'Active' : 'Inactive'}</Badge> },
    { key: 'actions', header: '', align: 'right', render: (_, row) => <Button variant="ghost" size="sm" onClick={() => openEdit(row)}><Pencil className="w-3.5 h-3.5" /></Button> },
  ]}
  keyField="id"
  emptyMessage={loading ? 'Loading categories...' : 'No categories yet.'}
/>
```

---

## 15. FilterBar

**Vị trí:** `components/ui/FilterBar.tsx` · **Type:** Client Component
**Dùng trong:** History list — search + active filter chips

```tsx
interface FilterBarProps {
  searchPlaceholder?: string
  searchValue: string
  onSearchChange: (value: string) => void
  activeFilters?: Array<{ key: string; label: string }>
  onRemoveFilter?: (key: string) => void
  onClearAll?: () => void
  onFilterClick?: () => void
}
```

Search input: pill `rounded-full` với `<Search>` icon overlay, `max-w-md`. Active filters: `<Badge variant="active" onRemove={...}>` + nút "Clear all" (`text-on-surface-var hover:text-error underline`).

**Usage:**
```tsx
<FilterBar
  searchPlaceholder="Search vocabulary, meaning..."
  searchValue={search}
  onSearchChange={setSearch}
  activeFilters={[{ key: 'lang', label: 'Japanese' }]}
  onRemoveFilter={(k) => removeFilter(k)}
  onClearAll={clearFilters}
/>
```

---

## 16. TagInput

**Vị trí:** `components/ui/TagInput.tsx` · **Type:** Client Component
**Dùng trong:** Create Card form — trường Tags

```tsx
interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string   // default '+ Add Tag'
  maxTags?: number       // default 10
}
```

Mỗi tag là `<Badge variant="neutral" onRemove={...}>`. Input thêm tag mới: `border border-dashed border-outline-var rounded-full`, thêm khi `Enter`/`,`/blur, xoá tag cuối khi `Backspace` trên input rỗng.

**Usage:**
```tsx
<TagInput tags={tags} onChange={setTags} placeholder="+ Add Tag" />
```

---

## 17. ProgressBar

**Vị trí:** `components/ui/ProgressBar.tsx` · **Type:** Server Component

```tsx
interface ProgressBarProps {
  value: number              // 0–100, tự clamp
  label?: string
  showPercent?: boolean
  size?: 'sm' | 'md'         // h-1.5 | h-2.5
  className?: string
}
```

Track `bg-surface-high rounded-full overflow-hidden`; fill `bg-primary` với `transition-all duration-500 ease-out`; có đầy đủ `role="progressbar"` + `aria-value*`.

**Usage:**
```tsx
<ProgressBar value={progress} label="Global Progress" showPercent />
<ProgressBar value={syncRate} size="sm" />  // thanh mỏng, vd. card maturity
```

---

## 18. StepIndicator

**Vị trí:** `components/ui/StepIndicator.tsx` · **Type:** Server Component
**Dùng trong:** `LoadingOverlay`, multi-step wizard

```tsx
type StepStatus = 'completed' | 'active' | 'pending'
interface Step { label: string; description?: string; status: StepStatus }
interface StepIndicatorProps { steps: Step[]; className?: string }
```

Icon tròn: `completed` → `bg-primary text-white` + `<Check>`; `active` → viền `border-2 border-primary`; `pending` → mờ `text-on-surface-var/40`. Mô tả của bước `active` hiển thị `italic`.

**Usage:**
```tsx
<StepIndicator steps={[
  { label: 'Calling Gemini AI...', status: 'completed' },
  { label: 'Generating audio pronunciation...', description: 'Synthesizing natural speech...', status: 'active' },
  { label: 'Finding images...', status: 'pending' },
]} />
```

---

## 19. FlowTip

**Vị trí:** `components/ui/FlowTip.tsx` · **Type:** Server Component
**Dùng cho:** AI tip / suggestion / educational callout (Ochre tertiary accent)

```tsx
interface FlowTipProps {
  children: React.ReactNode
  label?: string   // default 'Flow Tip'
  className?: string
}
```

`bg-tertiary-fixed/30 border border-tertiary-fixed/60 rounded-lg p-4`, icon `<Lightbulb>` trong vòng tròn `bg-tertiary-fixed`, label viết hoa `text-tertiary`.

**Usage:**
```tsx
<FlowTip label="Smart Enrichment Active">
  Our AI will automatically fetch <strong>native audio samples</strong>, <strong>stroke order diagrams</strong>, and <strong>3 context sentences</strong> based on your input.
</FlowTip>
```

---

## 20. LoadingOverlay

**Vị trí:** `components/ui/LoadingOverlay.tsx` · **Type:** Client Component
**Dùng cho:** màn hình "Generating..." khi gọi `/api/generate`

```tsx
interface LoadingOverlayProps {
  open: boolean
  title?: string       // default 'Generating Cognitive Asset'
  subtitle?: string
  steps: LoadingStep[]
  progress: number
  flowTip?: string
  statusText?: string  // hiển thị italic, mờ — vd. "This usually takes 10–20 seconds"
}
```

Composes `<StepIndicator>` + `<ProgressBar showPercent>` + `<FlowTip>` trong modal `max-w-md`, icon `<Brain>` ở header.

---

## 21. ConnectedBadge

**Vị trí:** `components/ui/ConnectedBadge.tsx` · **Type:** Client Component (poll Anki mỗi 30s)

```tsx
interface ConnectedBadgeProps {
  connected?: boolean   // override — nếu omit thì tự poll GET /api/anki/connect
}
```

- Polls `GET /api/anki/connect` (KHÔNG phải `/api/anki/status` — endpoint đó không tồn tại, từng gây lỗi 404 lặp lại) — `res.ok` (200) = connected, 503/500 = offline.
- Hiển thị: dot trạng thái + icon (`MonitorCheck` / `MonitorX`) + label viết hoa "Connected to Anki" / "Anki offline".
- Đặt ở cuối `NavigationSidebar` (`mt-auto`).

---

## 22. CardPreview

**Vị trí:** `components/preview/CardPreview.tsx` · **Type:** Client Component
**Dùng trong:** Preview page — live card preview (sticky pane bên phải)

```tsx
type CardTab = 'word_to_meaning' | 'meaning_to_word' | 'sentence'
interface CardPreviewProps { entry: Partial<Entry> }
```

`<Tabs>`-style switcher (Word → Meaning / Meaning → Word / Sentence) trên cùng; bên dưới là 1 thẻ lật được (`onClick` toggle `flipped`) hiển thị Front/Back tương ứng tab đang chọn — front `bg-white shadow-card`, back ẩn cho tới khi click.

---

## 23. WordDetailCard

**Vị trí:** `components/history/WordDetailCard.tsx` · **Type:** Client Component
**Dùng trong:** History Detail (`/history/[id]`) — hero card hiển thị từ vựng

```tsx
interface WordDetailCardProps { entry: Entry }
```

`bg-white rounded-xl shadow-card border-l-[4px] border-l-primary p-6 lg:p-8`. Header: `<Badge>` trạng thái sync ("Synced" / "Pending sync") + level + tên deck. Nội dung: reading nhỏ phía trên, từ chính `font-serif text-4xl lg:text-5xl font-bold`, nút phát audio (`<Volume2>`) nếu có `audio_url`.

---

## Checklist khi tạo / sửa component

```
□ Đọc DESIGN.md trước — đặc biệt mục 3 (Color), 7 (Shape), 8 (Component Rules), 10 (Responsive)
□ Token màu/font/radius/shadow lấy từ @theme trong globals.css — không hardcode hex/px
□ Server Component trừ khi cần state/effect/event handler
□ Dùng cn() để merge className props
□ Mọi icon từ lucide-react
□ Mọi UI copy bằng tiếng Anh (label, placeholder, alert, error, empty state...)
□ Mọi phần tử tương tác có focus-visible:ring-2 focus-visible:ring-primary/40
□ Destructive action có visual cảnh báo (error) + confirmation
□ Grid nhiều cột có breakpoint thu gọn cho mobile (grid-cols-1 sm:grid-cols-2 ...)
□ Không dùng FAB, không dùng bg-primary text-white cho nav active
□ Page/section title dùng font-serif, UI text dùng font-sans (mặc định)
```

---

*Tài liệu này đồng bộ với `DESIGN.md`. Khi thêm/sửa component hoặc design token, cập nhật cả hai file.*
