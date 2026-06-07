---
project: AnkiFlow
version: "3.0"
stack: Next.js 16 App Router · TypeScript 5 · Tailwind CSS v4
last_updated: 2026-06
---

# AnkiFlow — Design System

## Hướng dẫn sử dụng cho AI

> **Đây là nguồn sự thật duy nhất (single source of truth) cho mọi quyết định visual trong dự án.**
> Khi generate component, page, hay style, AI phải:
> 1. Đọc section liên quan trong file này trước khi viết code.
> 2. Không tự ý dùng màu, font, hoặc spacing ngoài hệ thống này.
> 3. Mọi token (màu, font, radius, shadow, label) được định nghĩa trong khối `@theme` của `app/globals.css` — **không có** `tailwind.config.ts` (Tailwind v4 dùng CSS-first config).
> 4. **Mọi chữ hiển thị cho người dùng (UI copy) phải là tiếng Anh** — xem mục "Ngôn ngữ giao diện" bên dưới. Tài liệu này có thể giữ tiếng Việt cho phần giải thích, nhưng code mẫu/copy UI luôn viết bằng tiếng Anh.
> 5. Khi không chắc về một quyết định style, hỏi — không tự đoán.

---

## 1. Brand Identity

**Tên:** AnkiFlow · **Tagline:** COGNITIVE SANCTUARY *(bất biến, dùng trên mọi màn hình)*

**Cá tính thương hiệu:** Intellectual · Nurturing · Efficient
**Cảm xúc mục tiêu:** Calm productivity — giao diện giảm cognitive load để người dùng tập trung vào nội dung.
**Phong cách:** Corporate Modern với Tactile Warmth — tông giấy ấm, typography humanist, tối giản và ít chuyển động ồn ào.

---

## 2. Ngôn ngữ giao diện (UI Language)

**Quy tắc cố định: 100% UI copy là tiếng Anh.**

- `app/layout.tsx` → `<html lang="en">`.
- Mọi label, placeholder, tiêu đề, mô tả, nút, badge, empty state, error message, `alert()`/`console.error` hiển thị cho người dùng → tiếng Anh, giọng văn ngắn gọn rõ ràng.
- **Ngoại lệ — KHÔNG đổi:**
  - Giá trị enum / khóa dữ liệu Firestore (`form_language`, `status`, field keys…) — đó là contract logic, không phải copy.
  - Nội dung do người dùng nhập hoặc dữ liệu thực thể (tên category, tên deck…) — đó là dữ liệu, không phải UI chrome.
  - Prompt gửi cho Gemini trong `lib/prompts/*.ts` — không hiển thị cho người dùng.

---

## 3. Color System

### Canonical Palette — định nghĩa trong `app/globals.css` (`@theme`)

Tailwind v4 dùng **CSS-first config**: mọi token khai báo bằng custom property `--color-*`, `--font-*`, `--radius-*`, `--shadow-*`, `--font-size-*` bên trong `@theme { ... }` và Tailwind tự sinh utility tương ứng (`bg-primary`, `text-on-surface-var`, `rounded-lg`, `shadow-card`…).

| Token | Hex | Tailwind class | Dùng cho |
|---|---|---|---|
| `primary` | `#316342` | `bg-primary` / `text-primary` | CTA chính, active state, icon nhấn mạnh |
| `on-primary` | `#ffffff` | `text-on-primary` | Text trên nền primary (KHÔNG hardcode `text-white`) |
| `primary-container` | `#4a7c59` | `bg-primary-container` | Hover của primary button |
| `primary-text` | `#e1ffe5` | `text-primary-text` | Text nhạt trên nền primary đậm |
| `primary-fixed` | `#b9efc5` | `bg-primary-fixed` | Tonal fill nhạt |
| `secondary` | `#655d52` | `bg-secondary` / `text-secondary` | Supporting UI, grounding elements |
| `secondary-container` | `#e9ded0` | `bg-secondary-container` | Tonal fills nhạt |
| `tertiary` | `#6d5622` | `text-tertiary` | Flow Tips, AI highlights, Ochre accent |
| `tertiary-container` | `#886e38` | `bg-tertiary-container` | Background cho AI badges |
| `tertiary-fixed` | `#ffdea0` | `bg-tertiary-fixed` | Light fill cho AI badges |
| `on-tertiary-fixed` | `#261a00` | `text-on-tertiary-fixed` | Text trên tertiary-fixed |
| `app-bg` | `#faf6f0` | `bg-app-bg` | **Nền page chính — cream ấm** |
| — (white) | `#ffffff` | `bg-white` | Card, modal, elevated surface |
| `surface-low` | `#f1f4f1` | `bg-surface-low` | Sidebar, top bar background |
| `surface-container` | `#ecefeb` | `bg-surface-container` | Hover state nhạt, input fill |
| `surface-high` | `#e6e9e6` | `bg-surface-high` | Category chips, disabled states |
| `on-surface` | `#181c1b` | `text-on-surface` | Text chính trên nền sáng |
| `on-surface-var` | `#414942` | `text-on-surface-var` | Text phụ, icon |
| `outline` | `#717971` | `border-outline` | Border mặc định |
| `outline-var` | `#c1c9bf` | `border-outline-var` | Border nhạt, divider |
| `error` | `#ba1a1a` | `text-error` / `bg-error` | Lỗi, destructive action |
| `error-container` | `#ffdad6` | `bg-error-container` | Background cảnh báo lỗi |
| `on-error` | `#93000a` | `text-on-error` | Text trên error-container |
| `inverse-surface` | `#2d312f` | `bg-inverse-surface` | Dark card, AI taxonomy footer |
| `inverse-on` | `#eef1ee` | `text-inverse-on` | Text trên inverse-surface |

> **Quy tắc cứng:** Cấm `text-gray-*` / `bg-gray-*` / hex tùy tiện. Mọi text phụ → `text-on-surface-var`; mọi viền → `border-outline-var`. Mọi màu phải tham chiếu token ở trên.

### `app/globals.css` — nguồn token thực tế (trích)

```css
@import "tailwindcss";

@theme {
  --color-primary:            #316342;
  --color-on-primary:         #ffffff;
  --color-primary-container:  #4a7c59;
  --color-primary-text:       #e1ffe5;
  --color-primary-fixed:      #b9efc5;

  --color-secondary:          #655d52;
  --color-secondary-container: #e9ded0;

  --color-tertiary:           #6d5622;
  --color-tertiary-container: #886e38;
  --color-tertiary-fixed:     #ffdea0;
  --color-on-tertiary-fixed:  #261a00;

  --color-app-bg:             #faf6f0;
  --color-surface-low:        #f1f4f1;
  --color-surface-container:  #ecefeb;
  --color-surface-high:       #e6e9e6;

  --color-on-surface:         #181c1b;
  --color-on-surface-var:     #414942;

  --color-outline:            #717971;
  --color-outline-var:        #c1c9bf;

  --color-error:              #ba1a1a;
  --color-error-container:    #ffdad6;
  --color-on-error:           #93000a;

  --color-inverse-surface:    #2d312f;
  --color-inverse-on:         #eef1ee;

  --font-serif: var(--font-serif), Georgia, serif;
  --font-sans:  var(--font-sans), sans-serif;

  --font-size-display:       36px;  --line-height-display: 1.2;       --font-weight-display: 700;
  --font-size-headline-md:   24px;  --line-height-headline-md: 1.3;   --font-weight-headline-md: 600;
  --font-size-headline-sm:   18px;  --line-height-headline-sm: 1.4;   --font-weight-headline-sm: 600;
  --font-size-body-md:       14px;  --line-height-body-md: 1.5;       --font-weight-body-md: 400;
  --font-size-label-lg:      14px;  --line-height-label-lg: 1;        --font-weight-label-lg: 700;
  --font-size-label-sm:      10px;  --line-height-label-sm: 1;        --font-weight-label-sm: 600;

  --radius-sm:   0.25rem;
  --radius:      0.5rem;
  --radius-md:   0.75rem;
  --radius-lg:   1rem;
  --radius-xl:   1.5rem;
  --radius-full: 9999px;

  --shadow-card:  0 4px 20px rgba(46,50,48,0.06);
  --shadow-modal: 0 20px 50px rgba(46,50,48,0.12);
}
```

> ⚠️ **Cảnh báo collision:** KHÔNG định nghĩa `--spacing-sm` / `--spacing-md` / `--spacing-lg` / `--spacing-xl` trong `@theme`. Tailwind v4 dùng chung namespace đặt tên cho `spacing` và cho size scale của `max-w-*` / `w-*` / `h-*` (`sm`/`md`/`lg`/`xl`) — định nghĩa `--spacing-sm: 8px` sẽ khiến `max-w-sm` resolve thành `8px` thay vì `24rem`. Đây là một regression đã từng xảy ra và được fix bằng cách xoá hẳn block `--spacing-*` (không có utility nào trong code dùng `p-sm`/`gap-md` nên an toàn khi xoá).

### Google Fonts Setup — `app/layout.tsx`

```tsx
import { Newsreader, Nunito_Sans } from 'next/font/google'

const newsreader = Newsreader({
  variable: '--font-serif',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
})

const nunitoSans = Nunito_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${nunitoSans.variable} h-full antialiased`}>
      <body className="bg-app-bg font-sans text-on-surface min-h-full flex">
        <NavigationSidebar />
        <main className="flex-1 min-h-screen pt-16 px-4 py-6 md:ml-64 md:pt-8 md:px-8 md:py-8 md:max-w-[calc(100vw-256px)]">
          {children}
        </main>
      </body>
    </html>
  )
}
```

---

## 4. Typography

### Quy tắc Serif / Sans-Serif

| Vai trò | Font | Class Tailwind |
|---|---|---|
| Page title, greeting, display, từ vựng trên mặt thẻ | Newsreader (serif) | `font-serif` |
| Section headline trong card | Newsreader (serif) | `font-serif` |
| Mọi UI text (label, button, body, navigation) | Nunito Sans | `font-sans` (mặc định) |
| AI-generated status, processing message | Nunito Sans, *italic* | `font-sans italic` |
| Code, Note ID, technical string | Monospace | `font-mono` |

### Thang Typography (token scale — bắt buộc dùng)

```
display     → font-serif text-display      (36px / 1.2 / 700)  — greeting, hero title
headline-md → font-serif text-headline-md  (24px / 1.3 / 600)  — page title
headline-sm → font-serif text-headline-sm  (18px / 1.4 / 600)  — card title, section heading
body-md     → font-sans  text-body-md      (14px / 1.5 / 400)  — paragraph, description
label-lg    → font-sans  text-label-lg     (14px / 1   / 700)  — button, nav active
label-sm    → font-sans  text-label-sm     (10px / 1   / 600)  — badge text, chip uppercase
```

> **Quy tắc:** Cấm `text-[Npx]` tùy tiện. Luôn dùng các bậc trên; nếu cần size trung gian, dùng `text-sm` / `text-base` / `text-xs` mặc định của Tailwind — không tự chế giá trị px.

---

## 5. Layout & Spacing

### App Shell — responsive (mobile drawer + desktop sidebar)

```
Desktop (md ≥ 768px)                      Mobile (< 768px)
┌──────────────┬──────────────────┐       ┌──────────────────────────┐
│ Sidebar      │ Main Content     │       │ Top bar (h-16, fixed)    │
│ w-64 fixed   │ flex-1           │       │  logo + hamburger        │
│ bg-surface-  │ md:ml-64         │       ├──────────────────────────┤
│ low          │ md:px-8 md:py-8  │       │ Main content             │
│              │                  │       │  pt-16 px-4 py-6         │
└──────────────┴──────────────────┘       │ (sidebar slides in as    │
                                           │  an overlay drawer)      │
                                           └──────────────────────────┘
```

- **Desktop (`md:` trở lên):** sidebar `w-64` (256px) cố định bên trái, `bg-surface-low`, `border-r border-outline-var`. Content `md:ml-64 md:px-8 md:py-8`.
- **Mobile (`< md`):** sidebar ẩn ngoài màn hình (`-translate-x-full`), thay bằng top bar `h-16 fixed` chứa logo + nút hamburger (`Menu`/`X` từ lucide-react). Bấm hamburger → sidebar trượt vào như drawer (`translate-x-0`, `transition-transform duration-200`) kèm backdrop `bg-inverse-surface/40`; đóng khi bấm backdrop hoặc khi điều hướng route. Content `pt-16 px-4 py-6`.
- Max content width theo loại trang: form `max-w-4xl`, list `max-w-6xl`, dashboard grid không giới hạn cứng.

### Grid trong Content Area

- Stat cards: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`
- Card grid 2-col (form sections, modal fields): `grid grid-cols-1 sm:grid-cols-2 gap-4`
- Content type selector (Create flow): `grid grid-cols-2 lg:grid-cols-4 gap-4`

> **Quy tắc responsive:** mọi grid nhiều cột phải có breakpoint thu gọn về 1 cột trên mobile (`grid-cols-1 sm:grid-cols-2 ...`) — không để cố định nhiều cột gây tràn/đè chữ ở viewport hẹp.

---

## 6. Elevation & Depth

Chỉ dùng **2 shadow** — không rải rác `shadow-sm/lg/xl/2xl`.

| Level | Surface | Shadow / Effect | Dùng cho |
|---|---|---|---|
| 0 — Base | `bg-app-bg` (#faf6f0) | Không có | Page background |
| 1 — Card | `bg-white` | `shadow-card` | Tất cả card, panel, stat card |
| 2 — Modal | `bg-white` | `shadow-modal` + backdrop blur | Dialog, modal, loading overlay |
| Dark — Inverse | `bg-inverse-surface` | Không có | AI feature banner, dark callout |

```tsx
// Level 1 — Card (dùng component <Card>)
<div className="bg-white rounded-xl shadow-card border border-outline-var/40 p-6">

// Level 2 — Modal
<div className="fixed inset-0 z-50 flex items-center justify-center p-4"
     style={{ background: 'rgba(24,28,27,0.4)', backdropFilter: 'blur(4px)' }}>
  <div className="bg-white rounded-xl shadow-modal w-full max-w-lg flex flex-col">
```

---

## 7. Shape Language — phân cấp rõ ràng (chọn 1, không lẫn lộn)

| Dùng cho | Class | px | Ví dụ |
|---|---|---|---|
| Button / pill / badge / chip / search bar | `rounded-full` | — | `<Button>`, `<Badge>`, `<TagInput>` |
| Input / select / textarea / control nhỏ / nav active item | `rounded-lg` | 16 | `<Input>`, `<Select>`, `<Textarea>`, sidebar active link |
| Card / section / modal / panel | `rounded-xl` | 24 | `<Card>`, `<Modal>`, `<StatCard>` |
| Chip nhỏ / inline code / icon badge | `rounded-md` | 12 | tag inline, mã code |

> ❌ Không dùng FAB (Floating Action Button — nút tròn nổi). Dùng text/icon button trong context.

---

## 8. Component Rules

### ✅ Button — xem spec đầy đủ ở `COMPONENT.md`

| Variant | Dùng cho |
|---|---|
| `primary` | CTA chính — `bg-primary text-on-primary hover:bg-primary-container` |
| `secondary` | Tonal — `bg-primary/10 text-primary` |
| `ghost` | Outline — `border border-outline-var text-on-surface-var` |
| `destructive` | Xoá / huỷ — `bg-error-container text-on-error hover:bg-error hover:text-white` |

Size: `sm` / `md` (mặc định) / `lg` / `xl` (dùng cho 1 CTA "hero" mỗi trang, ví dụ nút Generate).

### ✅ Badge / Chip

| Variant | Dùng cho |
|---|---|
| `neutral` | Category, mặc định |
| `active` / `inactive` / `pending` | Trạng thái entry, integration |
| `ai` | AI-related label |
| `language` / `level` | Ngôn ngữ, cấp độ từ vựng |

### ✅ Navigation — Responsive Sidebar / Drawer

Component: `components/layout/NavigationSidebar.tsx` (client component, tự quản lý state `mobileOpen`).

- **Desktop:** `<aside>` `w-64 h-screen bg-surface-low border-r border-outline-var fixed left-0 top-0 z-50`, luôn hiện (`md:translate-x-0`).
- **Mobile:** `<header>` top bar `md:hidden fixed top-0 inset-x-0 h-16 bg-surface-low border-b` chứa `<AnkiFlowLogo size="sm" />` + nút `Menu`. `<aside>` thêm `-translate-x-full` mặc định, `transition-transform duration-200`, mở bằng `translate-x-0`; backdrop `fixed inset-0 z-40 bg-inverse-surface/40` đóng khi click ra ngoài.
- Đóng drawer khi đổi route: **không** dùng `setState` trong `useEffect` (vi phạm `react-hooks/set-state-in-effect`) — dùng pattern "adjust state during render":
  ```tsx
  const [lastPathname, setLastPathname] = useState(pathname)
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setMobileOpen(false)
  }
  ```
- Nav item active: `bg-primary/10 text-primary font-bold`. **Cấm** `bg-primary text-white` cho active state.
- `ConnectedBadge` luôn ở cuối sidebar (`mt-auto`).

### ✅ Page Header (Breadcrumb)

```
Pattern: Home (icon) › [Parent page] › [Current page]
```

```tsx
<PageHeader
  crumbs={[{ label: 'Create Card', href: '/create' }, { label: 'Language Flow' }]}
  description="..."
  actions={<Button variant="primary">...</Button>}
/>
```
- Separator: `›` — không dùng `>`, `/`, hay `|`.
- Trang cuối cùng trong breadcrumb: `text-primary font-bold`.

### ✅ Logo Mark

```tsx
<AnkiFlowLogo />          // size="md" mặc định — dùng trong sidebar desktop
<AnkiFlowLogo size="sm" /> // dùng trong top bar mobile
// Luôn hiển thị: [sparkle icon trong vòng tròn primary] + "AnkiFlow" + "COGNITIVE SANCTUARY"
```

### ✅ Card / StatCard / EmptyState / FilterBar

Xem spec đầy đủ ở `COMPONENT.md`. Quy tắc chung:
- Card: `bg-white rounded-xl shadow-card border border-outline-var/40 p-6`.
- StatCard (label + icon): dùng `items-start justify-between gap-3` (KHÔNG `items-center`) để icon không đè lên label khi label wrap 2 dòng; icon có `flex-shrink-0`.
- EmptyState: icon tròn `bg-surface-container`, title `text-label-lg font-semibold`, mô tả `max-w-sm` (lưu ý: `max-w-sm` chỉ hoạt động đúng nếu KHÔNG có `--spacing-sm` collision — xem mục 3).

### ✅ Input / Form Field

```tsx
<Input className="w-full bg-surface-container rounded-lg px-4 py-3 ... focus-visible:ring-2 focus-visible:ring-primary/40" />
<Textarea ... />          // cùng style, resize-none
<Select ... />            // bg-surface-container, ChevronDown icon overlay
<FieldWrapper label="...">...</FieldWrapper>
```
Padding chuẩn `px-4 py-3`, nền `bg-surface-container`, bo góc `rounded-lg`, focus ring `focus-visible:ring-2 focus-visible:ring-primary/40`.

### ✅ Tabs

```tsx
<Tabs tabs={[{id, label}, ...]} activeTab={id} onChange={setId} />
```
Container `flex flex-wrap gap-1 bg-surface-low rounded-lg p-1`; mỗi tab `flex-1 whitespace-nowrap px-3 py-1.5 rounded-md`. **Phải có `flex-wrap`** để chịu được nhiều tab (ví dụ Admin có 5 tab) trên màn hẹp — không để tràn/đè chữ.

### ✅ Toggle / Switch

```tsx
<Toggle checked={value} onChange={setValue} label="..." description="..." />
```
Track `w-11 h-6 rounded-full`, thumb `w-5 h-5 bg-white rounded-full translate-x-5` khi bật, `bg-primary` khi checked / `bg-outline-var` khi tắt.

---

## 9. Consistency Rules — Danh sách bất biến

AI **không được** thay đổi hoặc "cải thiện" những điều này:

1. **Tagline** luôn là "COGNITIVE SANCTUARY".
2. **Active nav** luôn `bg-primary/10 text-primary font-bold` — không `bg-primary text-white`.
3. **Breadcrumb separator** luôn `›`.
4. **Card background** luôn `bg-white`.
5. **Page background** luôn `bg-app-bg` (#faf6f0).
6. **FAB button** không xuất hiện ở bất kỳ màn hình nào.
7. **Destructive action** luôn có visual cảnh báo (màu error) + confirmation dialog.
8. **Font pairing**: Headline = Newsreader serif, UI text = Nunito Sans. Không trộn lẫn.
9. **Ochre (tertiary)** chỉ dùng cho Flow Tips / AI highlights / AI badge.
10. **UI copy luôn là tiếng Anh** (xem mục 2) — enum/data key giữ nguyên.
11. **Chỉ 2 shadow**: `shadow-card` và `shadow-modal`.
12. **Border-radius theo phân cấp ở mục 7** — không trộn `rounded` / `rounded-2xl` tùy tiện.

---

## 10. Responsive Behavior

Đã chuyển từ desktop-only sang **responsive đầy đủ** (mobile drawer + sidebar). Mọi trang/grid mới phải test ở cả 3 mốc dưới đây bằng Playwright trước khi coi là hoàn thành:

| Breakpoint | Behavior |
|---|---|
| `lg` (1024px+) | Layout đầy đủ, sidebar cố định, grid nhiều cột |
| `md` (768–1023px) | Sidebar cố định (thu gọn nội dung main còn `calc(100vw-256px)`) |
| `< md` (điện thoại, ví dụ 390px) | Sidebar ẩn → top bar + drawer trượt; mọi grid co về 1 cột (`grid-cols-1 sm:grid-cols-2 ...`); `Tabs` dùng `flex-wrap` |

> ⚠️ Bài học từ refactor: viewport hẹp (390px) với sidebar `fixed w-64` không có breakpoint sẽ ép nội dung vào `calc(100vw-256px)` ≈ 134px, gây chữ vỡ từng từ và đè grid. Luôn kiểm bằng cách thu nhỏ viewport thực tế qua Playwright (`browser_resize` / `setViewportSize`), không chỉ đọc code.

---

## 11. Interaction States

| State | Visual |
|---|---|
| Default | Style base |
| Hover | Lighten background 5–10%, `transition-colors duration-150` |
| Active/Pressed | `active:scale-[0.98]`, `transition-transform duration-75` |
| Focus | `focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40` (bắt buộc trên mọi phần tử tương tác — cấm `focus:ring-0`) |
| Disabled | `disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none` |
| Loading | `<Loader2 className="animate-spin" />` + text "Generating..." / "Loading..." (tiếng Anh) |
| Error | Border `border-error`, helper text `text-error`, `<ErrorMessage>` component |

---

## 12. AI-Specific Patterns

| Element | Pattern |
|---|---|
| AI status badge | `bg-tertiary-fixed text-on-tertiary-fixed` + sparkle icon |
| AI suggestion text | Font italic, `text-on-surface-var` |
| AI-generated content | Left border `border-l-2 border-primary/30`, nền `bg-primary/5` |
| AI processing | `<StepIndicator>` — completed / active / pending |
| Flow Tip / Smart Enrichment banner | `bg-tertiary-fixed/30 border-tertiary-fixed` + `<FlowTip>` + label tiếng Anh ("Smart Enrichment Active", "Flow Tip") |
| AI accuracy metric | Bold, màu primary, kèm shield/checkmark icon |

---

*File này được maintain bởi team design. Mọi thay đổi cần review trước khi commit. Đồng bộ với `COMPONENT.md` khi thêm/sửa component hoặc token.*
