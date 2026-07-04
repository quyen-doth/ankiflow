import type { Metadata } from 'next'
import { Hanken_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { AppShell } from '@/components/layout/AppShell'
import { ToastProvider } from '@/components/ui/Toast'
import { MotionProvider } from '@/components/providers/MotionProvider'
import { AuthProvider } from '@/components/providers/AuthProvider'

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
        <AuthProvider>
          <MotionProvider>
            <ToastProvider>
              <AppShell>{children}</AppShell>
            </ToastProvider>
          </MotionProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
