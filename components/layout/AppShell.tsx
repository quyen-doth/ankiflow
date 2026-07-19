'use client'

import { usePathname } from 'next/navigation'
import { AuthSessionGuard } from '@/components/layout/AuthSessionGuard'
import { NavigationSidebar } from '@/components/layout/NavigationSidebar'
import { UnsavedChangesProvider } from '@/components/providers/UnsavedChangesProvider'
import { verifyAttrs } from '@/verify/core/contract'

/** auth 系 route: sidebar なし・offset なし — (auth)/layout が内容を中央寄せする。 */
const AUTH_ROUTES = ['/login', '/signup']

/**
 * アプリの Shell: NavigationSidebar + main (md+ では sidebar 分の offset)。
 * auth 画面では sidebar と offset の両方を外し、内容が全画面を使う。
 * (Route group (auth)/layout.tsx は root layout の内側に nest されるため、shell 自体は差し替えられない。)
 */
export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname()
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route || pathname?.startsWith(route + '/'))

  if (isAuthRoute) {
    return (
      <main
        className="flex-1 min-w-0 min-h-screen"
        {...verifyAttrs({ unit: 'AppShell', authRoute: true })}
      >
        {children}
      </main>
    )
  }

  return (
    <UnsavedChangesProvider>
      {/* cookie 有効 + client auth 喪失の split-brain を検出して /login へ強制遷移する */}
      <AuthSessionGuard />
      <NavigationSidebar />
      {/* Main: offset for mobile top bar, then for the sidebar at md+ */}
      <main
        className="flex-1 min-w-0 min-h-screen overflow-x-clip pt-16 px-4 py-6 md:ml-[240px] md:pt-8 md:px-8 md:py-8 xl:px-10 2xl:px-12 md:max-w-[calc(100vw-240px)]"
        {...verifyAttrs({ unit: 'AppShell', authRoute: false })}
      >
        {children}
      </main>
    </UnsavedChangesProvider>
  )
}
