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
      lang="vi"
      className={`${newsreader.variable} ${nunitoSans.variable} h-full antialiased`}
    >
      <body className="bg-app-bg font-sans text-on-surface min-h-full flex">
        <NavigationSidebar />
        {/* Main: offset sidebar width */}
        <main className="ml-64 flex-1 min-h-screen px-8 py-8 max-w-[calc(100vw-256px)]">
          {children}
        </main>
      </body>
    </html>
  )
}
