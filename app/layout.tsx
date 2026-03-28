import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BetIQ — AI Betting Coach',
  description: 'Track your football bets, analyze performance, and get AI-powered coaching.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0B0B14] min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  )
}
