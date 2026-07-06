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
      className={cn(
        'sticky top-16 md:top-0 z-10 -mx-4 md:-mx-8 md:-mt-8 mb-8 px-4 md:px-[34px] py-5',
        'border-b border-[#eaeae6] bg-canvas/85 backdrop-blur-md',
        className
      )}
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            {displayTitle && (
              <h1 className="text-page-title font-extrabold text-ink leading-tight tracking-[-0.02em]">
                {displayTitle}
              </h1>
            )}
            {description && (
              <p className="text-[13.5px] text-[#8c8f97] mt-1">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-3 flex-wrap sm:flex-shrink-0 sm:pt-1">
              {actions}
            </div>
          )}
        </div>
      )}
    </header>
  )
}
