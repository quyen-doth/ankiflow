import type { Metadata } from 'next'
import { Newsreader, Nunito_Sans } from 'next/font/google'
import './globals.css'
import { NavigationSidebar } from '@/components/layout/NavigationSidebar'

const newsreader = Newsreader({
  variable: '--font-serif',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
})

const nunitoSans = Nunito_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
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
      className={`${newsreader.variable} ${nunitoSans.variable} h-full antialiased`}
    >
      <body className="bg-app-bg font-sans text-on-surface min-h-full flex">
        <NavigationSidebar />
        {/* Main: offset for mobile top bar, then for the sidebar at md+ */}
        <main className="flex-1 min-h-screen pt-16 px-4 py-6 md:ml-64 md:pt-8 md:px-8 md:py-8 md:max-w-[calc(100vw-256px)]">
          {children}
        </main>
      </body>
    </html>
  )
}
