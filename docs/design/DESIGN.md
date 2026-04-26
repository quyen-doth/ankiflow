---
project: AnkiFlow
version: "2.0"
stack: Next.js 14 App Router · TypeScript 5 · Tailwind CSS 3
last_updated: 2025-01
---

# AnkiFlow — Design System

## Hướng dẫn sử dụng cho AI

> **Đây là nguồn sự thật duy nhất (single source of truth) cho mọi quyết định visual trong dự án.**
> Khi generate component, page, hay style, AI phải:
> 1. Đọc section liên quan trong file này trước khi viết code.
> 2. Không tự ý dùng màu, font, hoặc spacing ngoài hệ thống này.
> 3. Mọi class Tailwind phải có trong `tailwind.config.ts` hoặc là utility mặc định của Tailwind 3.
> 4. Khi không chắc về một quyết định style, hỏi — không tự đoán.

---

## 1. Brand Identity

**Tên:** AnkiFlow · **Tagline:** COGNITIVE SANCTUARY *(bất biến, dùng trên mọi màn hình)*

**Cá tính thương hiệu:** Intellectual · Nurturing · Efficient  
**Cảm xúc mục tiêu:** Calm productivity — giao diện giảm cognitive load để người dùng tập trung vào nội dung.  
**Phong cách:** Corporate Modern với Tactile Warmth. Tránh sự lạnh lẽo của SaaS điển hình; dùng tông giấy ấm và typography humanist.

---

## 2. Color System

### Canonical Palette

| Token | Hex | Tailwind key | Dùng cho |
|---|---|---|---|
| `primary` | `#316342` | `primary` | CTA chính, active state, icon nhấn mạnh |
| `primary-container` | `#4a7c59` | `primary-container` | Hover của primary button |
| `on-primary` | `#ffffff` | — | Text trên nền primary |
| `on-primary-container` | `#e1ffe5` | `primary-container-text` | Text nhạt trên primary-container |
| `secondary` | `#655d52` | `secondary` | Supporting UI, grounding elements |
| `secondary-container` | `#e9ded0` | `secondary-container` | Tonal fills nhạt |
| `on-secondary-container` | `#696156` | — | Text trên secondary-container |
| `tertiary` | `#6d5622` | `tertiary` | Flow Tips, AI highlights, Ochre accent |
| `tertiary-container` | `#886e38` | `tertiary-container` | Background cho AI badges |
| `tertiary-fixed` | `#ffdea0` | `tertiary-fixed` | Light fill cho AI badges |
| `on-tertiary-fixed` | `#261a00` | — | Text trên tertiary-fixed |
| `background` | `#faf6f0` | `app-bg` | **Nền page chính — cream ấm** |
| `surface` | `#ffffff` | — | Card, modal, elevated surface |
| `surface-container-low` | `#f1f4f1` | `surface-low` | Sidebar background |
| `surface-container` | `#ecefeb` | `surface-container` | Hover state nhạt |
| `surface-container-high` | `#e6e9e6` | `surface-high` | Category chips, disabled states |
| `on-surface` | `#181c1b` | `on-surface` | Text chính trên background sáng |
| `on-surface-variant` | `#414942` | `on-surface-variant` | Text phụ, icon |
| `outline` | `#717971` | `outline` | Border mặc định |
| `outline-variant` | `#c1c9bf` | `outline-variant` | Border nhạt, divider |
| `error` | `#ba1a1a` | `error` | Lỗi, destructive action |
| `error-container` | `#ffdad6` | `error-container` | Background cảnh báo lỗi |
| `on-error-container` | `#93000a` | — | Text trên error-container |
| `inverse-surface` | `#2d312f` | `inverse-surface` | Dark card (e.g., AI taxonomy footer) |
| `inverse-on-surface` | `#eef1ee` | — | Text trên inverse-surface |

> **Quy tắc cứng:** Không dùng màu nào ngoài bảng trên. Không dùng màu hex tùy tiện trong component. Mọi màu phải tham chiếu token.

### Tailwind Config — `tailwind.config.ts`

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:          '#316342',
        'primary-container': '#4a7c59',
        'primary-text':   '#e1ffe5',
        'primary-fixed':  '#b9efc5',
        secondary:        '#655d52',
        'secondary-container': '#e9ded0',
        tertiary:         '#6d5622',
        'tertiary-container': '#886e38',
        'tertiary-fixed': '#ffdea0',
        'on-tertiary-fixed': '#261a00',
        'app-bg':         '#faf6f0',
        'surface-low':    '#f1f4f1',
        'surface-container': '#ecefeb',
        'surface-high':   '#e6e9e6',
        'on-surface':     '#181c1b',
        'on-surface-var': '#414942',
        outline:          '#717971',
        'outline-var':    '#c1c9bf',
        error:            '#ba1a1a',
        'error-container': '#ffdad6',
        'on-error':       '#93000a',
        'inverse-surface': '#2d312f',
        'inverse-on':     '#eef1ee',
      },
      fontFamily: {
        serif:  ['Newsreader', 'Georgia', 'serif'],
        sans:   ['Nunito Sans', 'sans-serif'],
      },
      fontSize: {
        'display':   ['36px', { lineHeight: '1.2', fontWeight: '700' }],
        'headline-md': ['24px', { lineHeight: '1.3', fontWeight: '600' }],
        'headline-sm': ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        'body-md':   ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'label-lg':  ['14px', { lineHeight: '1', fontWeight: '700' }],
        'label-sm':  ['10px', { lineHeight: '1', fontWeight: '600', letterSpacing: '0.05em' }],
      },
      borderRadius: {
        sm: '0.25rem',   // 4px  — hiếm dùng
        DEFAULT: '0.5rem', // 8px — input, small button
        md: '0.75rem',   // 12px — nav active state
        lg: '1rem',      // 16px — card, container (DEFAULT cho hầu hết)
        xl: '1.5rem',    // 24px — large container
        full: '9999px',  // pill — chip, badge, search bar
      },
      boxShadow: {
        card:  '0 4px 20px rgba(46,50,48,0.06)',
        modal: '0 20px 50px rgba(46,50,48,0.12)',
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
      },
    },
  },
  plugins: [],
}

export default config
```

### Google Fonts Setup — `app/layout.tsx`

```tsx
import { Newsreader, Nunito_Sans } from 'next/font/google'

const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
})

const nunitoSans = Nunito_Sans({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${newsreader.variable} ${nunitoSans.variable}`}>
      <body className="bg-app-bg font-sans text-on-surface antialiased">
        {children}
      </body>
    </html>
  )
}
```

---

## 3. Typography

### Quy tắc Serif / Sans-Serif

| Vai trò | Font | Class Tailwind |
|---|---|---|
| Page title, greeting, display | Newsreader (serif) | `font-serif` |
| Section headline trong card | Newsreader (serif) | `font-serif` |
| Mọi UI text (label, button, body, navigation) | Nunito Sans | `font-sans` (default) |
| AI-generated status, processing message | Nunito Sans, *italic* | `font-sans italic` |
| Code, Note ID, technical string | Monospace | `font-mono` |

### Thang Typography

```
display    → font-serif text-display      (36px/1.2 bold)   — greeting, hero title
headline-md → font-serif text-headline-md  (24px/1.3 semibold) — page title
headline-sm → font-serif text-headline-sm  (18px/1.4 semibold) — card title, section heading
body-md    → font-sans text-body-md       (14px/1.5 regular) — paragraph, description
label-lg   → font-sans text-label-lg      (14px/1 bold)     — button, nav active
label-sm   → font-sans text-label-sm      (10px/1 semibold) — badge text, chip uppercase
```

> **Quy tắc:** Không dùng font-size tùy tiện. Luôn dùng các bậc trên. Nếu cần size trung gian (16px, 12px), dùng `text-base` và `text-xs` của Tailwind.

---

## 4. Layout & Spacing

### App Shell

```
┌─────────────────────────────────────────────────────┐
│  Sidebar (w-64, fixed)  │  Main Content (flex-1)     │
│  bg-surface-low         │  bg-app-bg                 │
│                         │  px-8 py-8 (32px margin)   │
└─────────────────────────────────────────────────────┘
```

- Sidebar: `w-64` (256px) · fixed height · `bg-surface-low` · `border-r border-outline-var`
- Content area: `flex-1 min-h-screen px-8 py-8`
- Max content width: `max-w-6xl` (không giới hạn cứng — responsive)

### Spacing Scale

| Token | Value | Dùng cho |
|---|---|---|
| `xs` / `gap-1` / `p-1` | 4px | Internal icon padding, tight chip |
| `sm` / `gap-2` / `p-2` | 8px | Gap giữa icon và text trong button |
| `md` / `gap-4` / `p-4` | 16px | Card internal padding (compact) |
| `lg` / `gap-6` / `p-6` | 24px | Card standard padding, section gap |
| `xl` / `gap-8` / `p-8` | 32px | Page margin, section spacing |

### Grid trong Content Area

- Full width: 12-col grid → `grid grid-cols-12 gap-6`
- Primary layout (8:4): main `col-span-8` · sidebar `col-span-4`
- Card grid 2-col: `grid grid-cols-2 gap-4`
- Stat cards: `grid grid-cols-4 gap-4`

---

## 5. Elevation & Depth

| Level | Surface | Shadow / Effect | Dùng cho |
|---|---|---|---|
| 0 — Base | `bg-app-bg` (#faf6f0) | Không có | Page background |
| 1 — Card | `bg-white` | `shadow-card` | Tất cả card, panel |
| 2 — Modal | `bg-white` | `shadow-modal` + backdrop blur | Dialog, modal focus |
| Dark — Inverse | `bg-inverse-surface` | Không có | AI feature banner, dark callout |

```tsx
// Level 1 Card
<div className="bg-white rounded-lg shadow-card border border-outline-var/40 p-6">

// Level 2 Modal
<div className="fixed inset-0 bg-on-surface/30 backdrop-blur-sm flex items-center justify-center">
  <div className="bg-white rounded-xl shadow-modal p-8 max-w-lg w-full">

// Dark / Inverse Card
<div className="bg-inverse-surface rounded-xl p-8 text-inverse-on">
```

---

## 6. Shape Language

| Context | Border radius | Tailwind class | Ví dụ |
|---|---|---|---|
| Card, container, panel | 16px | `rounded-lg` | Mọi card |
| Modal, large dialog | 20px | `rounded-xl` | Dialog box |
| Navigation active item | 12px | `rounded-md` | Nav pill |
| Input, small button | 8px | `rounded` | TextField, inline button |
| Badge, chip, tag, search bar | 9999px | `rounded-full` | Status chip, search |
| FAB-style icon button | 50% | `rounded-full` | ❌ Không dùng FAB pattern — xem Component Rules |

---

## 7. Component Rules

### ✅ Button

| Variant | Class pattern |
|---|---|
| Primary | `bg-primary text-white hover:bg-primary-container rounded-full px-5 py-2.5 text-label-lg transition-colors` |
| Secondary (tonal) | `bg-primary/10 text-primary hover:bg-primary/15 rounded-full px-5 py-2.5 text-label-lg transition-colors` |
| Ghost (outline) | `border border-outline-var text-on-surface-var hover:bg-surface-container rounded-full px-5 py-2.5 text-label-lg transition-colors` |
| Destructive | `bg-error-container text-on-error border border-error/20 hover:bg-error hover:text-white rounded-full px-5 py-2.5 text-label-lg transition-colors` |

> ❌ **KHÔNG** dùng Floating Action Button (FAB) — nút tròn nổi Material Design. Dùng text button hoặc icon button trong context thay thế.

### ✅ Badge / Chip

| Variant | Class pattern |
|---|---|
| Category (neutral) | `bg-surface-high text-on-surface-var rounded-full px-2.5 py-0.5 text-label-sm uppercase tracking-wide` |
| Status Active | `bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-label-sm uppercase tracking-wide` |
| Status Inactive | `bg-error-container text-on-error rounded-full px-2.5 py-0.5 text-label-sm uppercase tracking-wide` |
| Status Pending | `bg-tertiary-fixed text-on-tertiary-fixed rounded-full px-2.5 py-0.5 text-label-sm uppercase tracking-wide` |
| AI / Flow Tip | `bg-tertiary-fixed text-on-tertiary-fixed rounded-full px-2.5 py-0.5 text-label-sm uppercase tracking-wide` |

### ✅ Navigation Sidebar

- Container: `w-64 h-screen bg-surface-low border-r border-outline-var flex flex-col py-4 px-3`
- Logo area: `px-3 py-2 mb-4`
- Nav item (default): `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-on-surface-var hover:bg-primary/5 cursor-pointer transition-colors`
- Nav item (active): `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-bold text-primary bg-primary/10 cursor-pointer`
- Right accent bar trên active item: **KHÔNG dùng** — active state đã đủ rõ với bg + bold text.
- Connected badge (bottom): `mt-auto mx-3 mb-2 flex items-center gap-2 px-3 py-2 bg-surface-high rounded-lg text-xs text-on-surface-var`

> ❌ **Pattern bị cấm:** Active nav item với full green background (`bg-primary text-white`). Luôn dùng tonal (`bg-primary/10 text-primary`).

### ✅ Page Header (Breadcrumb)

```
Pattern duy nhất: [Parent page] > [Child page]
```

```tsx
// Luôn dùng component PageHeader, không tự viết inline
<PageHeader
  crumbs={[{ label: 'Create Card', href: '/create' }, { label: 'Language Flow' }]}
/>
// Renders: Home > Create Card > Language Flow
// Separator: › (›) — không dùng | hoặc /
```

### ✅ Logo Mark

```tsx
// Component bất biến — không tự render logo inline
<AnkiFlowLogo />
// Luôn hiển thị: [icon] + "AnkiFlow" + "COGNITIVE SANCTUARY"
// Icon: sparkle/leaf — nhất quán trên mọi màn hình
// Tagline: COGNITIVE SANCTUARY — không thay đổi
```

### ✅ Card

```tsx
// Standard card
<div className="bg-white rounded-lg shadow-card border border-outline-var/40 p-6">

// Compact card (trong grid)
<div className="bg-white rounded-lg shadow-card border border-outline-var/40 p-4">

// AI / Flow Tip card (tertiary tonal)
<div className="bg-tertiary-fixed/30 border border-tertiary-fixed rounded-lg p-4">
  <div className="flex items-start gap-3">
    <span className="text-tertiary">💡</span>
    <div>
      <p className="text-label-sm uppercase tracking-wide text-tertiary mb-1">Flow Tip</p>
      <p className="text-body-md text-on-surface">{tip}</p>
    </div>
  </div>
</div>

// Dark / Inverse card (AI feature banner)
<div className="bg-inverse-surface rounded-xl p-8 text-inverse-on">
```

### ✅ Input / Form Field

```tsx
// Text input
<input className="w-full bg-surface-container rounded border-0 px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-var/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />

// Textarea
<textarea className="w-full bg-surface-container rounded border-0 px-4 py-3 text-body-md resize-none focus:outline-none focus:ring-2 focus:ring-primary/30" />

// Select
<select className="w-full bg-white border border-outline-var rounded px-4 py-2.5 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none" />

// Field label
<label className="text-label-sm uppercase tracking-wide text-on-surface-var mb-1.5 block">
```

### ✅ Toggle / Switch

```tsx
// Dùng Tailwind peer pattern
<label className="flex items-center cursor-pointer">
  <div className="relative">
    <input type="checkbox" className="sr-only peer" />
    <div className="w-11 h-6 bg-outline-var rounded-full peer-checked:bg-primary transition-colors" />
    <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5" />
  </div>
</label>
```

### ✅ Progress Bar

```tsx
// Standard (loading modal)
<div className="h-2.5 bg-surface-high rounded-full overflow-hidden">
  <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
</div>

// Thin variant (card maturity)
<div className="h-1.5 bg-surface-high rounded-full overflow-hidden">
  <div className="h-full bg-primary rounded-full" style={{ width: `${value}%` }} />
</div>
```

---

## 8. Consistency Rules — Danh sách bất biến

Đây là các quyết định đã cố định. AI **không được** thay đổi hoặc "cải thiện" những điều này:

1. **Tagline** luôn là "COGNITIVE SANCTUARY" — không dùng "Flashcard Automation" hay bất kỳ variant nào khác.
2. **Active nav** luôn dùng `bg-primary/10 text-primary font-bold` — không dùng `bg-primary text-white`.
3. **Breadcrumb separator** luôn là `›` — không dùng `>`, `/`, hay `|`.
4. **Card background** luôn là `bg-white` — không dùng tông màu khác cho elevated surface.
5. **Page background** luôn là `bg-app-bg` (#faf6f0) — không dùng `bg-white` hay `bg-gray-50`.
6. **FAB button** không được xuất hiện trong bất kỳ màn hình nào.
7. **Delete/Destructive** button luôn có visual cảnh báo rõ ràng (màu error + confirmation dialog).
8. **Font pairing**: Headline = Newsreader serif, UI text = Nunito Sans. Không trộn lẫn.
9. **Ochre (tertiary)** chỉ dùng cho: Flow Tips, AI highlights, AI badge. Không dùng cho mục đích khác.
10. **Language breakdown bars** (và mọi categorical color) phải lấy từ palette hệ thống — không dùng màu arbitrary.

---

## 9. Responsive Behavior

Dự án hiện tại tập trung **desktop-first** (min-width: 1024px). Mobile layout chưa trong scope.

| Breakpoint | Behavior |
|---|---|
| `lg` (1024px+) | Layout đầy đủ với sidebar cố định |
| `md` (768px–1023px) | Sidebar collapse thành icon-only |
| `< md` | Out of scope hiện tại |

---

## 10. Interaction States

| State | Visual |
|---|---|
| Default | Style base |
| Hover | Lighten background 5–10%, `transition-colors duration-150` |
| Active/Pressed | Scale `scale-[0.98]`, `transition-transform duration-75` |
| Focus | `ring-2 ring-primary/30 ring-offset-1` |
| Disabled | `opacity-40 cursor-not-allowed pointer-events-none` |
| Loading | Spinner icon + text "Đang xử lý..." hoặc skeleton |
| Error | Border `border-error`, helper text màu `text-error`, icon ⚠ |

---

## 11. AI-Specific Patterns

Mọi AI-related UI element phải tuân theo nguyên tắc nhận biết được là "AI" nhưng không gây lo lắng:

| Element | Pattern |
|---|---|
| AI status badge | `bg-tertiary-fixed text-on-tertiary-fixed` + sparkle icon |
| AI suggestion text | Font italic, màu `text-on-surface-var` |
| AI-generated content | Left border `border-l-2 border-primary/30`, nền `bg-primary/5` |
| AI processing | Step indicator với trạng thái completed/active/pending rõ ràng |
| Flow Tip | `bg-tertiary-fixed/30 border-tertiary-fixed` + lightbulb icon + label "FLOW TIP" |
| AI accuracy metric | Font bold, màu primary, kèm shield/checkmark icon |

---

*File này được maintain bởi team design. Mọi thay đổi cần review trước khi commit.*
