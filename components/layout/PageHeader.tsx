import Link from 'next/link'
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
              <span className="text-on-surface-var mx-0.5">›</span>
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
