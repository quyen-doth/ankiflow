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
          const isActive = pathname === href || pathname?.startsWith(href + '/')
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
