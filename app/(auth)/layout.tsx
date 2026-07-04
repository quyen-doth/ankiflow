import { AnkiFlowLogo } from '@/components/ui/AnkiFlowLogo'

/**
 * Layout cho các trang auth (login/signup): logo + form card căn giữa.
 * AppShell (root layout) tự ẩn NavigationSidebar và bỏ offset trên các route này.
 */
export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-canvas">
      <div className="mb-7">
        <AnkiFlowLogo href="/login" />
      </div>
      <div className="w-full max-w-[400px]">{children}</div>
    </div>
  )
}
