'use client'

import { usePathname } from 'next/navigation'
import { NavigationSidebar } from '@/components/layout/NavigationSidebar'
import { UnsavedChangesProvider } from '@/components/providers/UnsavedChangesProvider'
import { verifyAttrs } from '@/verify/core/contract'

/** Các route auth: không sidebar, không offset — (auth)/layout tự căn giữa nội dung. */
const AUTH_ROUTES = ['/login', '/signup']

/**
 * Shell của app: NavigationSidebar + main (offset cho sidebar ở md+).
 * Trên các trang auth, cả sidebar lẫn offset đều bỏ — nội dung chiếm toàn màn hình.
 * (Route group (auth)/layout.tsx nest BÊN TRONG root layout nên không tự thay được shell.)
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
