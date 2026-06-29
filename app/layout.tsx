import type { Metadata } from 'next'
import { Hanken_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { NavigationSidebar } from '@/components/layout/NavigationSidebar'
import { ToastProvider } from '@/components/ui/Toast'
import { MotionProvider } from '@/components/providers/MotionProvider'

const hankenGrotesk = Hanken_Grotesk({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '700', '800'],
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AnkiFlow — Cognitive Sanctuary',
  description: 'AI-powered flashcard creation for Anki',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${hankenGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="bg-canvas font-sans text-ink min-h-full flex">
        <MotionProvider>
          <ToastProvider>
            <NavigationSidebar />
            {/* Main: offset for mobile top bar, then for the sidebar at md+ */}
            <main className="flex-1 min-w-0 min-h-screen overflow-x-clip pt-16 px-4 py-6 md:ml-[240px] md:pt-8 md:px-8 md:py-8 xl:px-10 2xl:px-12 md:max-w-[calc(100vw-240px)]">
              {children}
            </main>
          </ToastProvider>
        </MotionProvider>
      </body>
    </html>
  )
}
