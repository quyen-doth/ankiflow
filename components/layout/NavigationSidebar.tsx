'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
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
  const [userName, setUserName] = useState<string>('')

  useEffect(() => {
    async function fetchUserName() {
      try {
        const ref = doc(db, 'settings', 'default')
        const snap = await getDoc(ref)
        if (snap.exists()) {
          const data = snap.data()
          if (data.user_name) setUserName(data.user_name)
        }
      } catch { /* ignore */ }
    }
    fetchUserName()
  }, [])

  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setMobileOpen(false)
  }

  const nav = (
    <nav className="flex-1 flex flex-col gap-0.5 px-3.5">
      {navItems.map(({ label, href, icon: Icon }) => {
        const isActive = pathname === href || pathname?.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'relative flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-[13.5px] transition-colors duration-150',
              isActive
                ? 'bg-primary-bg text-primary font-bold'
                : 'text-slate-600 font-medium hover:bg-[#F0F0EC] hover:text-ink'
            )}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] bg-primary rounded-r-[3px]" />
            )}
            <Icon className={cn(
              'w-[17px] h-[17px] flex-shrink-0',
              isActive ? 'text-primary' : 'text-slate-600'
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
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 h-16 flex items-center justify-between px-4 bg-surface border-b border-border">
        <AnkiFlowLogo size="sm" />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          className="p-2 rounded-[8px] text-slate-600 hover:bg-[#F0F0EC] hover:text-ink focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-bg"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-ink/40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar / drawer */}
      <aside
        className={cn(
          'w-[248px] h-screen bg-surface flex flex-col py-[22px] fixed left-0 top-0 z-50 border-r border-border',
          'transition-transform duration-200 md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        {...verifyAttrs({ unit: 'NavigationSidebar', pathname, mobileOpen })}
      >
        <div className="px-3.5 py-2 mb-8 flex items-center justify-between">
          <AnkiFlowLogo />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className="md:hidden p-2 -mr-2 rounded-[8px] text-slate-600 hover:bg-[#F0F0EC] hover:text-ink focus:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-bg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <span className="px-6 mb-2 text-[11px] font-bold tracking-[0.05em] uppercase font-mono text-slate-400">
          Menu
        </span>

        {nav}

        {/* Bottom: Anki status + User */}
        <div className="mt-auto px-3.5 flex flex-col gap-3 pb-2">
          <ConnectedBadge />
          {userName && (
            <div className="flex items-center gap-3 px-3">
              <div className="w-[30px] h-[30px] rounded-full bg-slate-600 flex items-center justify-center flex-shrink-0">
                <span className="text-[13px] font-bold text-white">
                  {userName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-semibold text-ink truncate">{userName}</span>
                <span className="text-[11.5px] text-slate-400">Personal workspace</span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
