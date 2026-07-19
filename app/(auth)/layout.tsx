import { AnkiFlowLogo } from '@/components/ui/AnkiFlowLogo'

/**
 * auth 画面 (login/signup) の layout: logo + 中央寄せの form card。
 * AppShell (root layout) はこれらの route で NavigationSidebar を自動的に隠し offset も外す。
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
