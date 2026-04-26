# AnkiFlow — Component Library

> **Mục đích:** File này là spec đầy đủ để AI generate component đúng chuẩn trong một lần. Trước khi viết bất kỳ component nào, đọc file `DESIGN.md` để hiểu token hệ thống, sau đó dùng spec này để implement.
>
> **Stack:** Next.js 14 (App Router) · TypeScript 5 · Tailwind CSS 3

---

## Quy ước toàn file

- Mọi component đặt trong `src/components/ui/` (dùng chung) hoặc `src/components/[feature]/` (feature-specific).
- Client component (`'use client'`) chỉ khi có state, event handler, hoặc browser API.
- Server component là default — không thêm `'use client'` khi không cần.
- `cn()` là helper merge class (cài `clsx` + `tailwind-merge`):
  ```ts
  // src/lib/utils.ts
  import { clsx, type ClassValue } from 'clsx'
  import { twMerge } from 'tailwind-merge'
  export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
  ```
- Tất cả icon dùng `lucide-react` — không dùng emoji hay custom SVG inline.
- Mọi text visible với người dùng phải có thể localize — không hardcode string UI (trừ brand copy).

---

## Index

1. [AnkiFlowLogo](#1-ankiflowlogo)
2. [Button](#2-button)
3. [Badge / Chip](#3-badge--chip)
4. [Card](#4-card)
5. [NavigationSidebar](#5-navigationsidebar)
6. [PageHeader](#6-pageheader)
7. [StatCard](#7-statcard)
8. [Input / Textarea / Select](#8-input--textarea--select)
9. [Toggle (Switch)](#9-toggle-switch)
10. [ProgressBar](#10-progressbar)
11. [StepIndicator](#11-stepindicator)
12. [FlowTip](#12-flowtip)
13. [DataTable](#13-datatable)
14. [FilterBar](#14-filterbar)
15. [TagInput](#15-taginput)
16. [CardPreview](#16-cardpreview)
17. [IntegrationCard](#17-integrationcard)
18. [Modal / Dialog](#18-modal--dialog)
19. [LoadingOverlay](#19-loadingoverlay)
20. [AIBadge](#20-aibadge)
21. [ConnectedBadge](#21-connectedbadge)
22. [WordDetailCard](#22-worddetailcard)

---

## 1. AnkiFlowLogo

**Vị trí:** `src/components/ui/AnkiFlowLogo.tsx`  
**Type:** Server Component  
**Quy tắc:** Component này là nguồn sự thật duy nhất cho brand mark. Không render logo inline ở nơi khác.

```tsx
import { Sparkles } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface AnkiFlowLogoProps {
  href?: string
  className?: string
  size?: 'sm' | 'md'
}

export function AnkiFlowLogo({ href = '/dashboard', className, size = 'md' }: AnkiFlowLogoProps) {
  const content = (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className={cn(
        'flex items-center justify-center rounded-full bg-primary text-white flex-shrink-0',
        size === 'md' ? 'w-9 h-9' : 'w-7 h-7'
      )}>
        <Sparkles className={size === 'md' ? 'w-4 h-4' : 'w-3 h-3'} />
      </div>
      <div>
        <p className={cn('font-serif font-bold text-primary leading-none', size === 'md' ? 'text-lg' : 'text-base')}>
          AnkiFlow
        </p>
        <p className="text-[9px] font-semibold tracking-[0.12em] text-on-surface-var uppercase leading-none mt-0.5">
          Cognitive Sanctuary
        </p>
      </div>
    </div>
  )

  return href ? <Link href={href}>{content}</Link> : content
}
```

---

## 2. Button

**Vị trí:** `src/components/ui/Button.tsx`  
**Type:** Client Component (event handlers)

```tsx
'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantClasses = {
  primary:     'bg-primary text-white hover:bg-primary-container active:scale-[0.98]',
  secondary:   'bg-primary/10 text-primary hover:bg-primary/15 active:scale-[0.98]',
  ghost:       'border border-outline-var text-on-surface-var hover:bg-surface-container active:scale-[0.98]',
  destructive: 'bg-error-container text-on-error border border-error/20 hover:bg-error hover:text-white active:scale-[0.98]',
}

const sizeClasses = {
  sm: 'px-3.5 py-1.5 text-xs gap-1.5',
  md: 'px-5 py-2.5 text-label-lg gap-2',
  lg: 'px-6 py-3 text-base gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  children,
  className,
  disabled,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-bold transition-all duration-150',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  )
})

Button.displayName = 'Button'
```

**Usage:**
```tsx
<Button variant="primary" onClick={handleSubmit}>Apply Changes</Button>
<Button variant="secondary" leftIcon={<Download className="w-4 h-4" />}>Export Config</Button>
<Button variant="ghost">Cancel</Button>
<Button variant="destructive" leftIcon={<Trash2 className="w-4 h-4" />}>Delete from Anki</Button>
<Button loading>Generating...</Button>
```

---

## 3. Badge / Chip

**Vị trí:** `src/components/ui/Badge.tsx`  
**Type:** Server Component

```tsx
import { cn } from '@/lib/utils'

type BadgeVariant = 'neutral' | 'active' | 'inactive' | 'pending' | 'ai' | 'language' | 'level'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
  onRemove?: () => void  // nếu có → hiển thị nút ×
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral:  'bg-surface-high text-on-surface-var',
  active:   'bg-primary/10 text-primary',
  inactive: 'bg-error-container text-on-error',
  pending:  'bg-tertiary-fixed text-on-tertiary-fixed',
  ai:       'bg-tertiary-fixed text-on-tertiary-fixed',
  language: 'bg-primary/10 text-primary',
  level:    'bg-surface-high text-on-surface-var border border-outline-var/40',
}

export function Badge({ variant = 'neutral', children, className, onRemove }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5',
      'text-label-sm uppercase tracking-wide font-semibold',
      variantClasses[variant],
      className
    )}>
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 hover:opacity-70 transition-opacity leading-none"
          aria-label="Remove"
        >
          ×
        </button>
      )}
    </span>
  )
}
```

**Usage:**
```tsx
<Badge variant="neutral">STRUCTURED</Badge>
<Badge variant="active">Active</Badge>
<Badge variant="inactive">Inactive</Badge>
<Badge variant="pending">Pending</Badge>
<Badge variant="ai">AI Validated</Badge>
<Badge variant="language">Japanese</Badge>
<Badge onRemove={() => removeTag('Noun')}>Noun</Badge>
```

---

## 4. Card

**Vị trí:** `src/components/ui/Card.tsx`  
**Type:** Server Component

```tsx
import { cn } from '@/lib/utils'

interface CardProps {
  variant?: 'default' | 'compact' | 'dark' | 'ai-tip'
  className?: string
  children: React.ReactNode
  header?: React.ReactNode  // nếu có → tonal header area
}

const variantClasses = {
  default:  'bg-white rounded-lg shadow-card border border-outline-var/40 p-6',
  compact:  'bg-white rounded-lg shadow-card border border-outline-var/40 p-4',
  dark:     'bg-inverse-surface rounded-xl p-8 text-inverse-on',
  'ai-tip': 'bg-tertiary-fixed/30 border border-tertiary-fixed/60 rounded-lg p-4',
}

export function Card({ variant = 'default', className, children, header }: CardProps) {
  return (
    <div className={cn(variantClasses[variant], className)}>
      {header && (
        <div className={cn(
          '-mx-6 -mt-6 mb-5 px-6 py-4 rounded-t-lg',
          variant === 'dark' ? 'bg-white/10' : 'bg-surface-container'
        )}>
          {header}
        </div>
      )}
      {children}
    </div>
  )
}

// Convenience sub-components
export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn('font-serif text-headline-sm text-on-surface', className)}>{children}</h2>
}

export function CardDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-body-md text-on-surface-var mt-1', className)}>{children}</p>
}
```

---

## 5. NavigationSidebar

**Vị trí:** `src/components/layout/NavigationSidebar.tsx`  
**Type:** Client Component (active state)

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, PlusCircle, History, Shield, Settings } from 'lucide-react'
import { AnkiFlowLogo } from '@/components/ui/AnkiFlowLogo'
import { ConnectedBadge } from '@/components/ui/ConnectedBadge'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard',   href: '/dashboard',   icon: LayoutDashboard },
  { label: 'Create Card', href: '/create',       icon: PlusCircle },
  { label: 'History',     href: '/history',      icon: History },
  { label: 'Admin',       href: '/admin',        icon: Shield },
  { label: 'Settings',    href: '/settings',     icon: Settings },
] as const

export function NavigationSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 h-screen bg-surface-low border-r border-outline-var flex flex-col py-4 px-3 fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="px-2 py-2 mb-6">
        <AnkiFlowLogo />
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-0.5">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors duration-150',
                isActive
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'text-on-surface-var font-normal hover:bg-primary/5'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: Connected badge */}
      <ConnectedBadge />
    </aside>
  )
}
```

---

## 6. PageHeader

**Vị trí:** `src/components/layout/PageHeader.tsx`  
**Type:** Server Component

```tsx
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Crumb {
  label: string
  href?: string
}

interface PageHeaderProps {
  title?: string        // override breadcrumb cuối thành serif headline
  crumbs?: Crumb[]     // nếu có breadcrumb navigation
  description?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, crumbs, description, actions, className }: PageHeaderProps) {
  const displayTitle = title ?? crumbs?.[crumbs.length - 1]?.label

  return (
    <header className={cn('mb-8', className)}>
      {/* Breadcrumb */}
      {crumbs && crumbs.length > 1 && (
        <nav className="flex items-center gap-1 text-xs text-on-surface-var mb-2" aria-label="Breadcrumb">
          <Link href="/dashboard" className="hover:text-primary transition-colors">Home</Link>
          {crumbs.map((crumb, i) => (
            <span key={crumb.label} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3" />
              {crumb.href && i < crumbs.length - 1 ? (
                <Link href={crumb.href} className="hover:text-primary transition-colors">{crumb.label}</Link>
              ) : (
                <span className={i === crumbs.length - 1 ? 'text-primary font-semibold' : ''}>
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Title row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {displayTitle && (
            <h1 className="font-serif text-headline-md text-on-surface">{displayTitle}</h1>
          )}
          {description && (
            <p className="text-body-md text-on-surface-var mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-3 flex-shrink-0">{actions}</div>}
      </div>
    </header>
  )
}
```

**Usage:**
```tsx
// Dashboard — không breadcrumb
<PageHeader
  title="Control Center"
  description="Manage global system settings, data mapping, and form behavior."
  actions={<>
    <Button variant="ghost">Export Config</Button>
    <Button variant="primary">Apply Changes</Button>
  </>}
/>

// Create Card — có breadcrumb
<PageHeader
  crumbs={[
    { label: 'Create Card', href: '/create' },
    { label: 'Language Flow' },
  ]}
/>
```

---

## 7. StatCard

**Vị trí:** `src/components/ui/StatCard.tsx`  
**Type:** Server Component  
**Dùng trong:** Dashboard grid 4 cột

```tsx
import { TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  unit?: string
  trend?: string          // e.g. "+14%"
  trendPositive?: boolean
  className?: string
}

export function StatCard({ label, value, unit, trend, trendPositive = true, className }: StatCardProps) {
  return (
    <div className={cn('bg-white rounded-lg shadow-card border border-outline-var/40 p-5', className)}>
      <p className="text-label-sm uppercase tracking-wide text-on-surface-var mb-2">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-3xl font-bold text-on-surface">{value}</span>
        {unit && <span className="text-sm text-on-surface-var">{unit}</span>}
        {trend && (
          <span className={cn(
            'text-xs font-semibold flex items-center gap-0.5',
            trendPositive ? 'text-primary' : 'text-error'
          )}>
            <TrendingUp className="w-3 h-3" />
            {trend}
          </span>
        )}
      </div>
    </div>
  )
}
```

**Usage:**
```tsx
<div className="grid grid-cols-4 gap-4">
  <StatCard label="Total Vocabulary" value="1,240" trend="+14%" />
  <StatCard label="Total Anki Cards" value="3,450" />
  <StatCard label="Created Today" value="12" unit="cards" />
  <StatCard label="Success Rate" value="98%" />
</div>
```

---

## 8. Input / Textarea / Select

**Vị trí:** `src/components/ui/FormField.tsx`  
**Type:** Client Component

```tsx
'use client'

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// Shared field wrapper with label
interface FieldWrapperProps {
  label?: string
  error?: string
  className?: string
  children: React.ReactNode
}

export function FieldWrapper({ label, error, className, children }: FieldWrapperProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label className="text-label-sm uppercase tracking-wide text-on-surface-var">
          {label}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  )
}

// Text Input
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ error, className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full bg-surface-container rounded px-4 py-3',
      'text-body-md text-on-surface placeholder:text-on-surface-var/50',
      'border border-transparent focus:outline-none focus:ring-2 focus:ring-primary/30',
      'transition-shadow duration-150',
      error && 'ring-2 ring-error/50',
      className
    )}
    {...props}
  />
))
Input.displayName = 'Input'

// Textarea
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ error, className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full bg-surface-container rounded px-4 py-3 resize-none',
      'text-body-md text-on-surface placeholder:text-on-surface-var/50',
      'border border-transparent focus:outline-none focus:ring-2 focus:ring-primary/30',
      'transition-shadow duration-150',
      error && 'ring-2 ring-error/50',
      className
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

// Select
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ error, className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        'w-full bg-white border border-outline-var rounded px-4 py-2.5 appearance-none',
        'text-body-md text-on-surface',
        'focus:outline-none focus:ring-2 focus:ring-primary/30',
        error && 'border-error ring-2 ring-error/30',
        className
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-var pointer-events-none" />
  </div>
))
Select.displayName = 'Select'
```

---

## 9. Toggle (Switch)

**Vị trí:** `src/components/ui/Toggle.tsx`  
**Type:** Client Component

```tsx
'use client'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <div className="flex items-center justify-between py-4 px-5 bg-white rounded-lg border border-outline-var/40">
      <div className="flex-1 mr-4">
        <p className="text-sm font-semibold text-on-surface">{label}</p>
        {description && <p className="text-xs text-on-surface-var mt-0.5">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/30
          disabled:opacity-40 disabled:cursor-not-allowed
          ${checked ? 'bg-primary' : 'bg-outline-var'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow
            transition duration-200 ease-in-out mt-0.5
            ${checked ? 'translate-x-5' : 'translate-x-0.5'}
          `}
        />
      </button>
    </div>
  )
}
```

---

## 10. ProgressBar

**Vị trí:** `src/components/ui/ProgressBar.tsx`  
**Type:** Server Component

```tsx
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number           // 0–100
  label?: string
  showPercent?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function ProgressBar({ value, label, showPercent = false, size = 'md', className }: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className={cn('w-full', className)}>
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-label-sm uppercase tracking-wide text-on-surface-var">{label}</span>}
          {showPercent && <span className="text-xs font-semibold text-primary">{clampedValue}%</span>}
        </div>
      )}
      <div className={cn('bg-surface-high rounded-full overflow-hidden', size === 'md' ? 'h-2.5' : 'h-1.5')}>
        <div
          className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
          style={{ width: `${clampedValue}%` }}
          role="progressbar"
          aria-valuenow={clampedValue}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  )
}
```

---

## 11. StepIndicator

**Vị trí:** `src/components/ui/StepIndicator.tsx`  
**Type:** Server Component  
**Dùng trong:** Loading modal, multi-step wizard

```tsx
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type StepStatus = 'completed' | 'active' | 'pending'

interface Step {
  label: string
  description?: string
  status: StepStatus
}

interface StepIndicatorProps {
  steps: Step[]
  className?: string
}

export function StepIndicator({ steps, className }: StepIndicatorProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
            step.status === 'completed' && 'bg-primary text-white',
            step.status === 'active' && 'bg-surface-high text-primary border-2 border-primary',
            step.status === 'pending' && 'bg-surface-high text-on-surface-var/40',
          )}>
            {step.status === 'completed' ? (
              <Check className="w-4 h-4" />
            ) : (
              <span className="text-xs font-bold">{i + 1}</span>
            )}
          </div>

          {/* Label */}
          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-sm font-semibold',
              step.status === 'pending' ? 'text-on-surface-var/50' : 'text-on-surface'
            )}>
              {step.label}
            </p>
            {step.description && (
              <p className={cn(
                'text-xs mt-0.5',
                step.status === 'active' ? 'text-on-surface-var italic' : 'text-on-surface-var/50'
              )}>
                {step.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
```

**Usage:**
```tsx
<StepIndicator steps={[
  { label: 'Calling Gemini AI...', description: 'Contextual extraction complete', status: 'completed' },
  { label: 'Generating audio pronunciation...', description: 'Synthesizing natural speech patterns...', status: 'active' },
  { label: 'Finding images...', description: 'Awaiting audio completion', status: 'pending' },
]} />
```

---

## 12. FlowTip

**Vị trí:** `src/components/ui/FlowTip.tsx`  
**Type:** Server Component  
**Dùng cho:** Tất cả AI tip, suggestion, educational callout

```tsx
import { Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FlowTipProps {
  children: React.ReactNode
  label?: string  // default: "Flow Tip"
  className?: string
}

export function FlowTip({ children, label = 'Flow Tip', className }: FlowTipProps) {
  return (
    <div className={cn(
      'bg-tertiary-fixed/30 border border-tertiary-fixed/60 rounded-lg p-4',
      'flex items-start gap-3',
      className
    )}>
      <div className="w-7 h-7 rounded-full bg-tertiary-fixed flex items-center justify-center flex-shrink-0 mt-0.5">
        <Lightbulb className="w-3.5 h-3.5 text-tertiary" />
      </div>
      <div>
        <p className="text-label-sm uppercase tracking-wide text-tertiary mb-1">{label}</p>
        <p className="text-body-md text-on-surface">{children}</p>
      </div>
    </div>
  )
}
```

---

## 13. DataTable

**Vị trí:** `src/components/ui/DataTable.tsx`  
**Type:** Client Component  
**Pattern:** Compound component — `DataTable` + `DataTable.Column`

```tsx
'use client'

import { cn } from '@/lib/utils'

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

export function DataTable<T extends object>({
  data,
  columns,
  onRowClick,
  keyField,
  emptyMessage = 'No data',
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-outline-var/50">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                style={{ width: col.width }}
                className={cn(
                  'px-4 py-3 text-label-sm uppercase tracking-wide text-on-surface-var font-semibold',
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-12 text-on-surface-var text-sm">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={keyField ? String(row[keyField]) : i}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'border-b border-outline-var/30 transition-colors duration-100',
                  onRowClick && 'cursor-pointer hover:bg-surface-container/50'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={cn(
                      'px-4 py-3.5 text-body-md text-on-surface',
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    )}
                  >
                    {col.render
                      ? col.render(row[col.key as keyof T], row)
                      : String(row[col.key as keyof T] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
```

---

## 14. FilterBar

**Vị trí:** `src/components/ui/FilterBar.tsx`  
**Type:** Client Component  
**Dùng trong:** History list, bất kỳ trang có search + filter

```tsx
'use client'

import { Search, SlidersHorizontal } from 'lucide-react'
import { Badge } from './Badge'
import { Button } from './Button'

interface ActiveFilter {
  key: string
  label: string
}

interface FilterBarProps {
  searchPlaceholder?: string
  searchValue: string
  onSearchChange: (value: string) => void
  filters?: Array<{ label: string; value: string; options: string[] }>
  activeFilters?: ActiveFilter[]
  onRemoveFilter?: (key: string) => void
  onClearAll?: () => void
  onFilterClick?: () => void
}

export function FilterBar({
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  activeFilters = [],
  onRemoveFilter,
  onClearAll,
  onFilterClick,
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-var" />
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-white border border-outline-var rounded-full pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Filter button */}
        {onFilterClick && (
          <Button
            variant="primary"
            leftIcon={<SlidersHorizontal className="w-4 h-4" />}
            onClick={onFilterClick}
          >
            Filter
          </Button>
        )}
      </div>

      {/* Active filters */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-label-sm uppercase tracking-wide text-on-surface-var">Applied:</span>
          {activeFilters.map((f) => (
            <Badge key={f.key} variant="active" onRemove={() => onRemoveFilter?.(f.key)}>
              {f.label}
            </Badge>
          ))}
          <button onClick={onClearAll} className="text-xs text-on-surface-var hover:text-error underline transition-colors">
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
```

---

## 15. TagInput

**Vị trí:** `src/components/ui/TagInput.tsx`  
**Type:** Client Component  
**Dùng trong:** Create Card form — tags field

```tsx
'use client'

import { useState, type KeyboardEvent } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from './Badge'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  maxTags?: number
}

export function TagInput({ tags, onChange, placeholder = '+ Add Tag', maxTags = 10 }: TagInputProps) {
  const [inputValue, setInputValue] = useState('')

  const addTag = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && !tags.includes(trimmed) && tags.length < maxTags) {
      onChange([...tags, trimmed])
    }
    setInputValue('')
  }

  const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag))

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <Badge key={tag} variant="neutral" onRemove={() => removeTag(tag)}>
          {tag}
        </Badge>
      ))}
      {tags.length < maxTags && (
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(inputValue)}
          placeholder={placeholder}
          className="text-sm text-on-surface-var placeholder:text-on-surface-var/60 border border-dashed border-outline-var rounded-full px-3 py-0.5 focus:outline-none focus:border-primary min-w-20 bg-transparent"
        />
      )}
    </div>
  )
}
```

---

## 16. CardPreview

**Vị trí:** `src/components/features/card/CardPreview.tsx`  
**Type:** Client Component  
**Dùng trong:** Review Generation screen — live preview bên phải

```tsx
'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

type PreviewTab = 'front-back' | 'back-front' | 'sentence'

interface CardPreviewProps {
  word: string
  reading?: string
  meaning: string
  exampleSentence?: string
  level?: string
  targetDeck?: string
}

export function CardPreview({ word, reading, meaning, exampleSentence, level, targetDeck }: CardPreviewProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>('front-back')

  const tabs: Array<{ key: PreviewTab; label: string }> = [
    { key: 'front-back', label: 'Word → Meaning' },
    { key: 'back-front', label: 'Meaning → Word' },
    { key: 'sentence', label: 'Sentence' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-surface-container rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors',
              activeTab === tab.key
                ? 'bg-white text-primary shadow-sm'
                : 'text-on-surface-var hover:text-on-surface'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Front card */}
      <div className="bg-white rounded-xl shadow-card border border-outline-var/40 p-8 text-center min-h-40 flex flex-col items-center justify-center gap-2">
        <p className="text-label-sm uppercase tracking-wide text-on-surface-var mb-2">Front</p>
        {activeTab === 'front-back' ? (
          <>
            <p className="font-serif text-4xl font-bold text-on-surface">{word}</p>
            {reading && <p className="text-sm text-on-surface-var">{reading}</p>}
          </>
        ) : activeTab === 'back-front' ? (
          <p className="text-xl text-on-surface">{meaning}</p>
        ) : (
          <p className="text-lg text-on-surface">{exampleSentence}</p>
        )}
      </div>

      {/* Back card */}
      <div className="bg-surface-low rounded-xl border border-outline-var/40 p-6 min-h-32">
        <p className="text-label-sm uppercase tracking-wide text-on-surface-var mb-3">Back</p>
        {activeTab === 'front-back' ? (
          <>
            <p className="font-serif text-xl font-semibold text-primary mb-1">{meaning}</p>
            {exampleSentence && <p className="text-sm text-on-surface-var">{exampleSentence}</p>}
          </>
        ) : activeTab === 'back-front' ? (
          <p className="font-serif text-2xl font-bold text-on-surface">{word}</p>
        ) : (
          <p className="text-sm text-on-surface">{meaning}</p>
        )}
        {level && (
          <div className="mt-3">
            <Badge variant="level">{level}</Badge>
          </div>
        )}
      </div>

      {/* Target deck */}
      {targetDeck && (
        <div>
          <p className="text-label-sm uppercase tracking-wide text-on-surface-var mb-2">Target Deck</p>
          <div className="bg-white border border-outline-var rounded-lg px-4 py-3 text-sm font-semibold text-on-surface">
            {targetDeck}
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## 17. IntegrationCard

**Vị trí:** `src/components/features/settings/IntegrationCard.tsx`  
**Type:** Client Component  
**Dùng trong:** Settings page — connections grid

```tsx
'use client'

import { type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

type IntegrationStatus = 'active' | 'inactive' | 'pending'

interface IntegrationCardProps {
  icon: LucideIcon
  name: string
  description: string
  status: IntegrationStatus
  actionLabel: string
  onAction: () => void
}

const statusConfig: Record<IntegrationStatus, { variant: Parameters<typeof Badge>[0]['variant']; label: string }> = {
  active:   { variant: 'active',   label: 'Active' },
  inactive: { variant: 'inactive', label: 'Inactive' },
  pending:  { variant: 'pending',  label: 'Pending' },
}

export function IntegrationCard({ icon: Icon, name, description, status, actionLabel, onAction }: IntegrationCardProps) {
  const { variant, label } = statusConfig[status]

  return (
    <div className="bg-white rounded-lg shadow-card border border-outline-var/40 p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <Icon className="w-6 h-6 text-on-surface-var" />
        <Badge variant={variant}>{label}</Badge>
      </div>
      <div>
        <p className="font-semibold text-sm text-on-surface">{name}</p>
        <p className="text-xs text-on-surface-var mt-1 leading-relaxed">{description}</p>
      </div>
      <Button
        variant={status === 'inactive' ? 'primary' : 'ghost'}
        size="sm"
        onClick={onAction}
        className="w-full"
      >
        {actionLabel}
      </Button>
    </div>
  )
}
```

---

## 18. Modal / Dialog

**Vị trí:** `src/components/ui/Modal.tsx`  
**Type:** Client Component

```tsx
'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export function Modal({ open, onClose, title, description, children, size = 'md', className }: ModalProps) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(24, 28, 27, 0.4)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={cn('bg-white rounded-xl shadow-modal w-full flex flex-col', sizeClasses[size], className)}>
        {/* Header (tonal) */}
        {title && (
          <div className="bg-surface-container rounded-t-xl px-6 py-4 flex items-start justify-between">
            <div>
              <h2 className="font-serif text-headline-sm text-on-surface">{title}</h2>
              {description && <p className="text-body-md text-on-surface-var mt-0.5">{description}</p>}
            </div>
            <button onClick={onClose} className="text-on-surface-var hover:text-on-surface transition-colors ml-4 mt-0.5">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
```

---

## 19. LoadingOverlay

**Vị trí:** `src/components/ui/LoadingOverlay.tsx`  
**Type:** Client Component  
**Dùng cho:** Screen 2 — Generating Cognitive Asset

```tsx
'use client'

import { Brain } from 'lucide-react'
import { StepIndicator } from './StepIndicator'
import { ProgressBar } from './ProgressBar'
import { FlowTip } from './FlowTip'

interface LoadingStep {
  label: string
  description?: string
  status: 'completed' | 'active' | 'pending'
}

interface LoadingOverlayProps {
  open: boolean
  title?: string
  subtitle?: string
  steps: LoadingStep[]
  progress: number
  flowTip?: string
  statusText?: string
}

export function LoadingOverlay({
  open,
  title = 'Generating Cognitive Asset',
  subtitle = 'Refining semantic associations for long-term retention',
  steps,
  progress,
  flowTip,
  statusText,
}: LoadingOverlayProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(24,28,27,0.3)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-white rounded-xl shadow-modal w-full max-w-md p-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
            <Brain className="w-8 h-8 text-primary/60" />
          </div>
          <div>
            <h2 className="font-serif text-headline-sm text-primary">{title}</h2>
            <p className="text-body-md text-on-surface-var mt-1">{subtitle}</p>
          </div>
        </div>

        {/* Steps */}
        <StepIndicator steps={steps} />

        {/* Progress */}
        <ProgressBar value={progress} label="Global Progress" showPercent />

        {/* Flow tip */}
        {flowTip && <FlowTip>{flowTip}</FlowTip>}

        {/* Status text */}
        {statusText && (
          <p className="text-center text-xs text-on-surface-var/60 italic">{statusText}</p>
        )}
      </div>
    </div>
  )
}
```

---

## 20. AIBadge

**Vị trí:** `src/components/ui/AIBadge.tsx`  
**Type:** Server Component

```tsx
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AIBadgeProps {
  label: string
  className?: string
}

export function AIBadge({ label, className }: AIBadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-3 py-1',
      'bg-tertiary-fixed text-on-tertiary-fixed',
      'text-label-sm uppercase tracking-wide font-semibold',
      className
    )}>
      <Sparkles className="w-3 h-3" />
      {label}
    </span>
  )
}
```

---

## 21. ConnectedBadge

**Vị trí:** `src/components/ui/ConnectedBadge.tsx`  
**Type:** Client Component (realtime connection status)

```tsx
'use client'

import { MonitorCheck } from 'lucide-react'

interface ConnectedBadgeProps {
  connected?: boolean
  label?: string
}

export function ConnectedBadge({ connected = true, label = 'Connected to Anki' }: ConnectedBadgeProps) {
  return (
    <div className="mx-2 mb-1 flex items-center gap-2 px-3 py-2.5 bg-surface-high rounded-lg">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-primary' : 'bg-outline'}`} />
      <MonitorCheck className="w-4 h-4 text-on-surface-var" />
      <span className="text-xs text-on-surface-var truncate">{label}</span>
    </div>
  )
}
```

---

## 22. WordDetailCard

**Vị trí:** `src/components/features/history/WordDetailCard.tsx`  
**Type:** Server Component  
**Dùng trong:** Screen 5 — Word History Detail (main content card)

```tsx
import { Volume2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

interface WordDetailCardProps {
  word: string
  reading: string
  romanization?: string
  wordType?: string
  level: string
  status?: string
  meaning: string
}

export function WordDetailCard({ word, reading, romanization, wordType, level, status, meaning }: WordDetailCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-card border-l-4 border-l-primary border-t border-r border-b border-outline-var/40 p-8">
      {/* Level + Status */}
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="level">{level}</Badge>
        {status && <Badge variant="active">{status}</Badge>}
        <button className="ml-auto w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/15 transition-colors" aria-label="Play pronunciation">
          <Volume2 className="w-4 h-4 text-primary" />
        </button>
      </div>

      {/* Word */}
      <h1 className="font-serif text-5xl font-bold text-on-surface mb-2">{word}</h1>

      {/* Reading */}
      <p className="text-on-surface-var mb-1">
        <span className="text-primary font-medium">{reading}</span>
        {romanization && <span className="ml-2 text-sm">({romanization})</span>}
        {wordType && <span className="ml-2 text-sm italic text-on-surface-var/70">{wordType}</span>}
      </p>

      {/* Meaning */}
      <div className="mt-4">
        <p className="text-label-sm uppercase tracking-wide text-on-surface-var mb-2">Meaning</p>
        <p className="font-serif text-xl text-on-surface leading-relaxed">{meaning}</p>
      </div>
    </div>
  )
}
```

---

## Checklist khi generate component mới

```
□ Đọc DESIGN.md trước — đặc biệt section 7 (Component Rules) và 8 (Consistency Rules)
□ Dùng Tailwind token từ tailwind.config.ts, không hardcode hex
□ Server Component trừ khi cần state/effect/event handler
□ Dùng cn() để merge className props
□ Mọi icon từ lucide-react
□ Destructive action có visual cảnh báo + confirmation
□ Form field có label visible và error state
□ Component có TypeScript interface đầy đủ cho props
□ Không dùng FAB, không dùng `bg-primary text-white` cho nav active
□ Page title dùng font-serif, UI text dùng font-sans
```

---

*Tài liệu này đồng bộ với `DESIGN.md`. Khi thay đổi design token, cập nhật cả hai file.*
