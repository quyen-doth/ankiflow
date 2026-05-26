'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  PlusCircle,
  History,
  Shield,
  Settings,
} from 'lucide-react'
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
    <aside className="w-64 h-screen bg-white flex flex-col py-6 fixed left-0 top-0 z-30 border-r border-gray-100">
      <div className="pl-8 pr-4 py-2 mb-10">
        <AnkiFlowLogo />
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname?.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex items-center gap-4 py-3 pl-8 pr-6 text-sm transition-all duration-200 mr-6 rounded-r-full',
                isActive
                  ? 'border border-[#316342] border-l-0 text-[#316342] font-bold bg-white'
                  : 'border border-transparent border-l-0 text-gray-500 font-medium hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className={cn(
                'w-5 h-5 flex-shrink-0 transition-colors',
                isActive ? 'text-[#316342]' : 'text-gray-400'
              )} />
              <span className="tracking-wide">{label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Bottom: ConnectedBadge */}
      <div className="mt-auto pl-8 pr-6 pb-2">
        <ConnectedBadge />
      </div>
    </aside>
  )
}