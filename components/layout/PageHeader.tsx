import Link from 'next/link'
import { Home } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  return (
    <header className={cn('mb-8', className)}>
      {/* Breadcrumb */}
      {crumbs && crumbs.length > 0 && (
        <nav className="flex items-center text-sm font-medium text-gray-600" aria-label="Breadcrumb">
          {/* Home icon link */}
          <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 transition-colors flex items-center">
            <Home className="w-4 h-4" />
          </Link>

          {crumbs.map((crumb, i) => (
            <span key={crumb.label} className="flex items-center">
              <span className="text-gray-400 mx-2.5 font-normal">›</span>
              {crumb.href && i < crumbs.length - 1 ? (
                <Link href={crumb.href} className="text-gray-600 hover:text-gray-900 transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span className={cn(
                  i === crumbs.length - 1
                    ? 'text-[#316342] font-bold'
                    : 'text-gray-600'
                )}>
                  {crumb.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}
    </header>
  )
}