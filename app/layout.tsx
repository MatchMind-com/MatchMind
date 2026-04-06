import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'BetIQ — AI Betting Coach',
    template: '%s | BetIQ',
  },
  description: 'Track your football bets, get AI value bet predictions with EV analysis, and improve your returns with an AI football coach. Free to start.',
  keywords: ['football betting', 'AI betting tips', 'value bets', 'betting tracker', 'football predictions', 'EV betting', 'bet tracker app'],
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://footballbetai.vercel.app',
    siteName: 'BetIQ',
    title: 'BetIQ — AI Betting Coach',
    description: 'Track your football bets, get AI value bet predictions with EV analysis, and improve your returns with an AI football coach.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BetIQ — AI Betting Coach',
    description: 'Track your football bets, get AI value bet predictions with EV analysis, and improve your returns.',
  },
  robots: { index: true, follow: true },
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
