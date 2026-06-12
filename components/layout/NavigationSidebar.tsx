'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  PlusCircle,
  History,
  Shield,
  Settings,
  Menu,
  X,
} from 'lucide-react'
import { AnkiFlowLogo } from '@/components/ui/AnkiFlowLogo'
import { ConnectedBadge } from '@/components/ui/ConnectedBadge'
import { cn } from '@/lib/utils'
import { verifyAttrs } from '@/verify/core/contract'

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

  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setMobileOpen(false)
  }

  const nav = (
    <nav className="flex-1 flex flex-col gap-1 px-3">
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
                : 'text-on-surface-var font-medium hover:bg-primary/5 hover:text-on-surface'
            )}
          >
            <Icon className={cn(
              'w-5 h-5 flex-shrink-0',
              isActive ? 'text-primary' : 'text-on-surface-var'
            )} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )

  return (
    <>
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 h-16 flex items-center justify-between px-4 bg-surface-low border-b border-outline-var">
        <AnkiFlowLogo size="sm" />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          className="p-2 rounded-md text-on-surface-var hover:bg-primary/5 hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-inverse-surface/40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar / drawer */}
      <aside
        className={cn(
          'w-64 h-screen bg-surface-low flex flex-col py-6 fixed left-0 top-0 z-50 border-r border-outline-var',
          'transition-transform duration-200 md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        {...verifyAttrs({ unit: 'NavigationSidebar', pathname, mobileOpen })}
      >
        <div className="px-4 py-2 mb-10 flex items-center justify-between">
          <AnkiFlowLogo />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className="md:hidden p-2 -mr-2 rounded-md text-on-surface-var hover:bg-primary/5 hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {nav}

        {/* Bottom: ConnectedBadge */}
        <div className="mt-auto px-3 pb-2">
          <ConnectedBadge />
        </div>
      </aside>
    </>
  )
}
