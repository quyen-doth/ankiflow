import type { Metadata } from "next";
import { Newsreader, Nunito_Sans } from "next/font/google";
import "./globals.css";
import { NavigationSidebar } from "@/components/layout/NavigationSidebar";

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AnkiFlow",
  description: "Cognitive Sanctuary for Anki",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${nunitoSans.variable} h-full antialiased`}
    >
      <body className="bg-app-bg font-sans text-on-surface antialiased min-h-full flex flex-col">
        <NavigationSidebar />
        <main className="ml-64 flex-1 px-8 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
