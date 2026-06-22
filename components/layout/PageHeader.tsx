import Link from 'next/link'
import { Home } from 'lucide-react'
import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

interface Crumb {
  label: string
  href?: string
}

interface PageHeaderProps {
  title?: string
  crumbs?: Crumb[]
  description?: string
  actions?: React.ReactNode
  className?: string
}

export function PageHeader({ title, crumbs, description, actions, className }: PageHeaderProps) {
  const displayTitle = title ?? crumbs?.[crumbs.length - 1]?.label

  return (
    <header
      className={cn('mb-8', className)}
      {...verifyAttrs({ unit: 'PageHeader', crumbs: crumbs?.length ?? 0 })}
    >
      {/* Breadcrumb */}
      {crumbs && crumbs.length > 0 && (
        <nav className="flex items-center text-meta font-mono text-slate-400 mb-3" aria-label="Breadcrumb">
          <Link href="/dashboard" className="text-slate-400 hover:text-ink transition-colors flex items-center">
            <Home className="w-4 h-4" />
          </Link>

          {crumbs.map((crumb, i) => (
            <span key={crumb.label} className="flex items-center">
              <span className="text-slate-400/50 mx-2.5 font-normal">›</span>
              {crumb.href && i < crumbs.length - 1 ? (
                <Link href={crumb.href} className="text-slate-400 hover:text-ink transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className={cn(
                  i === crumbs.length - 1
                    ? 'text-primary font-bold'
                    : 'text-slate-400'
                )}>
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Title row */}
      {(displayTitle || description || actions) && (
        <div className="flex items-start justify-between gap-4">
          <div>
            {displayTitle && (
              <h1 className="text-page-title font-extrabold text-ink leading-tight tracking-[-0.02em]">
                {displayTitle}
              </h1>
            )}
            {description && (
              <p className="text-body text-slate-600 mt-1.5">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-3 flex-shrink-0 pt-1">
              {actions}
            </div>
          )}
        </div>
      )}
    </header>
  )
}
