import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = {
  themeColor: '#F97316',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  title: 'MatchMind — AI Football Intelligence',
  description: 'AI-powered football predictions, value bets with Pinnacle edge detection, and an AI betting coach. Track your bets and grow your bankroll.',
  applicationName: 'MatchMind',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MatchMind',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'MatchMind — AI Football Intelligence',
    description: 'AI-powered football predictions and value bets. Find the edge before kickoff.',
    type: 'website',
    siteName: 'MatchMind',
  },
  twitter: {
    card: 'summary',
    title: 'MatchMind — AI Football Intelligence',
    description: 'AI-powered football predictions and value bets.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-[#0B0B14] min-h-screen antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
